const { ethers } = require("ethers");

const cuzdanAdresi = "0xBE54a3E276E86B48eAc6d857fFa03b4a1916EcBd"; // Senin adresin

async function bakiyeSor() {
    console.log("📡 Alternatif Kapıdan Bağlanılıyor...");

    // YENİ ADRES:
    const provider = new ethers.JsonRpcProvider("https://polygon-bor-rpc.publicnode.com");

    try {
        const bakiye = await provider.getBalance(cuzdanAdresi);
        const okunabilirBakiye = ethers.formatEther(bakiye);

        console.log("------------------------------------------------");
        console.log(`💰 Cüzdan: ${cuzdanAdresi}`);
        console.log(`💎 Bakiye: ${okunabilirBakiye} POL`);
        console.log("------------------------------------------------");

    } catch (error) {
        console.error("❌ Hata:", error.message);
    }
}

bakiyeSor();
