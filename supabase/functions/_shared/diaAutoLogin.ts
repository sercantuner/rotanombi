// Shared DIA auto-login utility for all edge functions
// Automatically re-authenticates when session expires
// Team member'lar team admin'in DIA bağlantı bilgilerini kullanır

export interface DiaSession {
  sessionId: string;
  sunucuAdi: string;
  firmaKodu: number;
  donemKodu: number;
  expiresAt: string;
}

export interface DiaAutoLoginResult {
  success: boolean;
  session?: DiaSession;
  error?: string;
  // Hangi kullanıcının bilgileri kullanılıyor (team admin devralmada farklı olabilir)
  effectiveUserId?: string;
}

/**
 * Team admin'i bulur - eğer kullanıcı bir team member ise admin'in ID'sini döndürür
 * Aksi halde kullanıcının kendi ID'sini döndürür
 */
async function getEffectiveUserId(supabase: any, userId: string): Promise<string> {
  try {
    // Önce kullanıcının bir team member olup olmadığını kontrol et
    const { data: teamData } = await supabase
      .from("user_teams")
      .select("admin_id")
      .eq("member_id", userId)
      .single();
    
    if (teamData?.admin_id) {
      console.log(`[DIA Auth] User ${userId} is a team member, using admin ${teamData.admin_id}'s DIA credentials`);
      return teamData.admin_id;
    }
    
    // Team member değilse kendi ID'sini kullan
    return userId;
  } catch (error) {
    // Hata olursa (örn: no rows) kendi ID'sini kullan
    console.log(`[DIA Auth] User ${userId} has no team admin, using own credentials`);
    return userId;
  }
}

/**
 * Session'ın yakında expire olup olmayacağını kontrol eder
 */
function isSessionExpiringSoon(expiresAt: string, bufferMinutes: number = 2): boolean {
  if (!expiresAt) return true;
  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  return new Date(expiresAt).getTime() <= now.getTime() + bufferMs;
}

/**
 * Mevcut session'ı geçersiz kılar (force refresh için)
 */
export async function invalidateSession(supabase: any, userId: string): Promise<void> {
  const effectiveUserId = await getEffectiveUserId(supabase, userId);
  
  await supabase
    .from("profiles")
    .update({
      dia_session_id: null,
      dia_session_expires: null,
    })
    .eq("user_id", effectiveUserId);
  
  console.log(`[DIA Auth] Session invalidated for user ${effectiveUserId}`);
}

/**
 * Zorla yeni login yapar (mevcut session'ı yok sayarak)
 */
async function performAutoLogin(supabase: any, userId: string): Promise<DiaAutoLoginResult> {
  const effectiveUserId = await getEffectiveUserId(supabase, userId);
  
  // Get user's profile with DIA credentials
  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", effectiveUserId)
    .single();

  const profile = data as any;

  if (profileError || !profile) {
    return { 
      success: false, 
      error: "Profil bulunamadı",
      effectiveUserId
    };
  }

  // Check if we have required DIA credentials
  if (!profile.dia_sunucu_adi || !profile.dia_api_key || !profile.dia_ws_kullanici || !profile.dia_ws_sifre) {
    return { 
      success: false, 
      error: "DIA bağlantı bilgileri eksik",
      effectiveUserId
    };
  }

  console.log(`[DIA Auth] Performing auto-login for user ${effectiveUserId}...`);

  const diaUrl = `https://${profile.dia_sunucu_adi}.ws.dia.com.tr/api/v3/sis/json`;
  const loginPayload = {
    login: {
      username: profile.dia_ws_kullanici,
      password: profile.dia_ws_sifre,
      disconnect_same_user: true,
      Lang: "tr",
      params: {
        apikey: profile.dia_api_key,
      },
    },
  };

  const diaResponse = await fetch(diaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginPayload),
  });

  if (!diaResponse.ok) {
    return { success: false, error: `DIA bağlantı hatası: ${diaResponse.status}`, effectiveUserId };
  }

  const diaData = await diaResponse.json();

  // Check for DIA error
  if (diaData.error || diaData.hata) {
    const errorMsg = diaData.error?.message || diaData.hata?.aciklama || "DIA giriş hatası";
    return { success: false, error: errorMsg, effectiveUserId };
  }

  // Extract session_id
  let sessionId = null;
  if (diaData.code === "200" && diaData.msg) {
    sessionId = diaData.msg;
  } else if (diaData.login?.session_id) {
    sessionId = diaData.login.session_id;
  } else if (diaData.session_id) {
    sessionId = diaData.session_id;
  } else if (typeof diaData.msg === "string" && diaData.msg.length > 20) {
    sessionId = diaData.msg;
  }

  if (!sessionId) {
    return { success: false, error: "DIA oturum ID alınamadı", effectiveUserId };
  }

  // Update session in database
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      dia_session_id: sessionId,
      dia_session_expires: expiresAt,
    })
    .eq("user_id", effectiveUserId);

  if (updateError) {
    console.error(`[DIA Auth] Failed to update DIA session: ${updateError.message}`);
  }

  console.log(`[DIA Auth] Auto-login successful for user ${effectiveUserId}`);

  return {
    success: true,
    session: {
      sessionId,
      sunucuAdi: profile.dia_sunucu_adi,
      firmaKodu: parseInt(profile.firma_kodu) || 1,
      donemKodu: parseInt(profile.donem_kodu) || 0,
      expiresAt,
    },
    effectiveUserId
  };
}

/**
 * Gets a valid DIA session for the user.
 * If the user is a team member, uses the team admin's DIA credentials.
 * If the current session is expired, automatically re-authenticates using stored credentials.
 */
export async function getDiaSession(
  supabase: any,
  userId: string
): Promise<DiaAutoLoginResult> {
  try {
    // Team member ise admin'in ID'sini al, değilse kendi ID'sini kullan
    const effectiveUserId = await getEffectiveUserId(supabase, userId);
    const isUsingAdminCredentials = effectiveUserId !== userId;
    
    if (isUsingAdminCredentials) {
      console.log(`[DIA Auth] Team member ${userId} will use team admin ${effectiveUserId}'s DIA connection`);
    }

    // Get user's profile with DIA credentials (team admin veya kendisi)
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", effectiveUserId)
      .single();

    const profile = data as any;

    if (profileError || !profile) {
      return { 
        success: false, 
        error: isUsingAdminCredentials 
          ? "Takım yöneticinizin profili bulunamadı" 
          : "Profil bulunamadı" 
      };
    }

    // Check if we have required DIA credentials
    if (!profile.dia_sunucu_adi || !profile.dia_api_key || !profile.dia_ws_kullanici || !profile.dia_ws_sifre) {
      return { 
        success: false, 
        error: isUsingAdminCredentials
          ? "Takım yöneticinizin DIA bağlantı bilgileri eksik. Lütfen yöneticinizle iletişime geçin."
          : "DIA bağlantı bilgileri eksik. Lütfen Ayarlar sayfasından DIA bağlantısını yapılandırın.",
        effectiveUserId
      };
    }

    // Check if current session is still valid (with 2 minute buffer)
    const sessionValid = profile.dia_session_id && 
      profile.dia_session_expires && 
      !isSessionExpiringSoon(profile.dia_session_expires, 2);

    if (sessionValid) {
      console.log(`[DIA Auth] Using existing session for user ${effectiveUserId}${isUsingAdminCredentials ? ` (on behalf of ${userId})` : ''}`);
      return {
        success: true,
        session: {
          sessionId: profile.dia_session_id,
          sunucuAdi: profile.dia_sunucu_adi,
          firmaKodu: parseInt(profile.firma_kodu) || 1,
          donemKodu: parseInt(profile.donem_kodu) || 0,
          expiresAt: profile.dia_session_expires,
        },
        effectiveUserId
      };
    }

    // Session expired or doesn't exist - perform auto-login
    console.log(`[DIA Auth] Session expired for user ${effectiveUserId}, performing auto-login...`);
    return await performAutoLogin(supabase, userId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`[DIA Auth] Error: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Ensures session is valid, refreshes if needed.
 * Use this before each DIA API call in long-running operations.
 */
export async function ensureValidSession(
  supabase: any,
  userId: string,
  currentSession?: DiaSession
): Promise<DiaAutoLoginResult> {
  // Eğer mevcut session varsa ve geçerliyse kullan
  if (currentSession && !isSessionExpiringSoon(currentSession.expiresAt, 2)) {
    return { success: true, session: currentSession };
  }
  
  // Session yok veya expire olacak - yeni session al
  return await getDiaSession(supabase, userId);
}

/**
 * Checks if an error indicates an invalid session
 */
export function isInvalidSessionError(error: any): boolean {
  if (!error) return false;
  
  const errorString = typeof error === 'string' ? error : 
    error.message || error.msg || JSON.stringify(error);
  
  return errorString.includes('INVALID_SESSION') || 
         errorString.includes('401') ||
         errorString.includes('session') && errorString.includes('invalid');
}

/**
 * Wrapper that automatically retries an operation if session is invalid.
 * Useful for long-running sync operations.
 */
export async function withSessionRetry<T>(
  supabase: any,
  userId: string,
  operation: (session: DiaSession) => Promise<T>,
  maxRetries: number = 1
): Promise<{ success: boolean; result?: T; error?: string }> {
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Get (potentially fresh) session
      const sessionResult = await getDiaSession(supabase, userId);
      
      if (!sessionResult.success || !sessionResult.session) {
        return { success: false, error: sessionResult.error || "Session alınamadı" };
      }
      
      // Execute operation
      const result = await operation(sessionResult.session);
      return { success: true, result };
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      
      // If it's a session error and we have retries left, invalidate and retry
      if (isInvalidSessionError(error) && attempt < maxRetries) {
        console.log(`[DIA Auth] Session invalid, invalidating and retrying (attempt ${attempt + 1}/${maxRetries + 1})...`);
        await invalidateSession(supabase, userId);
        continue;
      }
      
      // Otherwise, throw the error
      break;
    }
  }
  
  return { success: false, error: lastError || "Bilinmeyen hata" };
}

/**
 * Exports for backwards compatibility and explicit usage
 */
export { getEffectiveUserId, performAutoLogin };
