const { ethers } = require("ethers");

async function baglantiTesti() {
    // 1. Polygon Test Ağına (Amoy) bağlanıyoruz
    // Bu halka açık ücretsiz bir kapıdır (RPC URL)
    const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology/");

    console.log("📡 Blockchain ağına bağlanılıyor...");

    try {
        // 2. Ağdan "Şu an kaçıncı bloktayız?" bilgisini istiyoruz
        const blokNumarasi = await provider.getBlockNumber();
        
        console.log("✅ Bağlantı Başarılı!");
        console.log(`🧱 Şu anki Blok Numarası: ${blokNumarasi}`);
        console.log("-------------------------------------------");
        console.log("Tebrikler, şu an Polygon ağının nabzını tutuyorsun.");
        
    } catch (error) {
        console.error("❌ Bağlantı Hatası:", error.message);
    }
}

baglantiTesti();
