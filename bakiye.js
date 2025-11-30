const { ethers } = require("ethers");

const cuzdanAdresi = "0x9ddc467d2731bd58a0a8bd00cb06aaf74ad1a7c9"; // Senin adresin

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
