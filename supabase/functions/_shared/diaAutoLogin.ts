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
    const now = new Date();
    const bufferMs = 2 * 60 * 1000; // 2 minutes buffer
    const sessionValid = profile.dia_session_id && 
      profile.dia_session_expires && 
      new Date(profile.dia_session_expires).getTime() > now.getTime() + bufferMs;

    if (sessionValid) {
      console.log(`Using existing DIA session for user ${effectiveUserId}${isUsingAdminCredentials ? ` (on behalf of ${userId})` : ''}`);
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
    console.log(`DIA session expired for user ${effectiveUserId}, performing auto-login...`);

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

    console.log(`Auto-login to DIA: ${profile.dia_sunucu_adi}`);

    const diaResponse = await fetch(diaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginPayload),
    });

    if (!diaResponse.ok) {
      return { success: false, error: `DIA bağlantı hatası: ${diaResponse.status}`, effectiveUserId };
    }

    const diaData = await diaResponse.json();
    console.log("DIA auto-login response:", JSON.stringify(diaData).substring(0, 500));

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

    // Update session in database - ALWAYS update the effective user's profile (team admin)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        dia_session_id: sessionId,
        dia_session_expires: expiresAt,
      })
      .eq("user_id", effectiveUserId);

    if (updateError) {
      console.error(`Failed to update DIA session: ${updateError.message}`);
    }

    console.log(`DIA auto-login successful for user ${effectiveUserId}${isUsingAdminCredentials ? ` (on behalf of ${userId})` : ''}`);

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`DIA auto-login error: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Exports for backwards compatibility and explicit usage
 */
export { getEffectiveUserId };
