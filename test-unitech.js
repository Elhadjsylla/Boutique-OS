async function testUnitech() {
  // 🔴 1. REMPLACE LA VALEUR CI-DESSOUS PAR TA VRAIE CLÉ UNITECH
  const API_KEY = "TA_VRAIE_CLE_UNITECH";

  if (API_KEY === "TA_VRAIE_CLE_UNITECH") {
    console.error("❌ Erreur : Tu dois d'abord remplacer 'TA_VRAIE_CLE_UNITECH' par ta clé !");
    return;
  }

  console.log("⏳ Test de l'API Unitech en cours...");

  try {
    const response = await fetch("https://api.unitech.sn/api.php?action=create_wave_payment", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 2900,
        customer_number: "771234567",
        description: "Test unitaire",
        callback_success: "https://boutikos.app",
        callback_cancel: "https://boutikos.app"
      })
    });

    const data = await response.json();
    
    console.log("\n📊 RÉPONSE DE L'API UNITECH :");
    console.log(data);

    if (data.success === false && data.error_code === 401) {
      console.log("\n🚨 CONCLUSION : La clé API est INVALIDE. C'est pour ça que la fonction crashe en 500.");
    } else if (data.success === true) {
      console.log("\n✅ CONCLUSION : La clé API est VALIDE. Le problème vient donc de Supabase qui n'arrive pas à la lire (il faut peut-être redéployer la fonction).");
    }

  } catch (error) {
    console.error("Erreur lors de la requête :", error.message);
  }
}

testUnitech();
