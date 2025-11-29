const { ethers } = require("ethers");

// BURAYA KENDİ CÜZDAN ADRESİNİ YAPIŞTIRMAN GEREKİYOR!
// Tırnakların içine az önce oluşturduğun 0x... adresini yaz.
const cuzdanAdresi = "0xBE54a3E276E86B48eAc6d857fFa03b4a1916EcBd"; 

async function bakiyeSor() {
    const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology/");

    try {
        const bakiye = await provider.getBalance(cuzdanAdresi);
        
        // Blockchain parayı "Wei" denilen çok küçük birimle tutar. 
        // Bunu okunabilir "Ether/Matic" formatına çeviriyoruz.
        const okunabilirBakiye = ethers.formatEther(bakiye);

        console.log("------------------------------------------------");
        console.log(`💰 Cüzdan: ${cuzdanAdresi}`);
        console.log(`💎 Bakiye: ${okunabilirBakiye} MATIC`);
        console.log("------------------------------------------------");

        if (okunabilirBakiye > 0) {
            console.log("✅ Süper! Yakıtımız (Gas) var. İşleme başlayabiliriz.");
        } else {
            console.log("⚠️ Bakiye Sıfır. Faucet'ten tekrar para istemelisin.");
        }

    } catch (error) {
        console.error("Hata:", error.message);
    }
}

bakiyeSor();
