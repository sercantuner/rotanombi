// Shared DIA auto-login utility for all edge functions
// Automatically re-authenticates when session expires

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
}

/**
 * Gets a valid DIA session for the user.
 * If the current session is expired, automatically re-authenticates using stored credentials.
 */
export async function getDiaSession(
  supabase: any,
  userId: string
): Promise<DiaAutoLoginResult> {
  try {
    // Get user's profile with DIA credentials
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const profile = data as any;

    if (profileError || !profile) {
      return { success: false, error: "Profil bulunamadı" };
    }

    // Check if we have required DIA credentials
    if (!profile.dia_sunucu_adi || !profile.dia_api_key || !profile.dia_ws_kullanici || !profile.dia_ws_sifre) {
      return { success: false, error: "DIA bağlantı bilgileri eksik. Lütfen Ayarlar sayfasından DIA bağlantısını yapılandırın." };
    }

    // Check if current session is still valid (with 2 minute buffer)
    const now = new Date();
    const bufferMs = 2 * 60 * 1000; // 2 minutes buffer
    const sessionValid = profile.dia_session_id && 
      profile.dia_session_expires && 
      new Date(profile.dia_session_expires).getTime() > now.getTime() + bufferMs;

    if (sessionValid) {
      console.log(`Using existing DIA session for user ${userId}`);
      return {
        success: true,
        session: {
          sessionId: profile.dia_session_id,
          sunucuAdi: profile.dia_sunucu_adi,
          firmaKodu: parseInt(profile.firma_kodu) || 1,
          donemKodu: parseInt(profile.donem_kodu) || 0,
          expiresAt: profile.dia_session_expires,
        },
      };
    }

    // Session expired or doesn't exist - perform auto-login
    console.log(`DIA session expired for user ${userId}, performing auto-login...`);

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
      return { success: false, error: `DIA bağlantı hatası: ${diaResponse.status}` };
    }

    const diaData = await diaResponse.json();
    console.log("DIA auto-login response:", JSON.stringify(diaData).substring(0, 500));

    // Check for DIA error
    if (diaData.error || diaData.hata) {
      const errorMsg = diaData.error?.message || diaData.hata?.aciklama || "DIA giriş hatası";
      return { success: false, error: errorMsg };
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
      return { success: false, error: "DIA oturum ID alınamadı" };
    }

    // Update session in database
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        dia_session_id: sessionId,
        dia_session_expires: expiresAt,
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error(`Failed to update DIA session: ${updateError.message}`);
    }

    console.log(`DIA auto-login successful for user ${userId}`);

    return {
      success: true,
      session: {
        sessionId,
        sunucuAdi: profile.dia_sunucu_adi,
        firmaKodu: parseInt(profile.firma_kodu) || 1,
        donemKodu: parseInt(profile.donem_kodu) || 0,
        expiresAt,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Beklenmeyen hata";
    console.error(`DIA auto-login error: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
