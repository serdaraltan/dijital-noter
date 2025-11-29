const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { ethers } = require("ethers");

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- AYARLAR ---
const PRIVATE_KEY = "0xb5dc9e82563aa7f44295af9d8f0e49fa28cc984d595d1d6abb0cca6409bf29f8"; 
const PROVIDER_URL = "https://rpc-amoy.polygon.technology/";
const PORT = 3001;

// --- FONKSİYONLAR ---
function hashHesapla(dosyaYolu) {
    const fileBuffer = fs.readFileSync(dosyaYolu);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function blockchainKayit(hash) {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const tx = await wallet.sendTransaction({
        to: wallet.address,
        value: 0,
        data: '0x' + hash
    });
    await tx.wait();
    return tx.hash;
}

// --- TASARIM (HTML & CSS) ---
// Modern, Dark Mode ve Responsive Tasarım
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TrustChain | Dijital Varlık Noteri</title>
    <style>
        :root { --primary: #6366f1; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; }
        body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { background: var(--card); padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 90%; max-width: 450px; text-align: center; border: 1px solid #334155; }
        h1 { margin-bottom: 0.5rem; font-size: 1.8rem; background: -webkit-linear-gradient(45deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.5; }
        .upload-box { border: 2px dashed #475569; border-radius: 0.5rem; padding: 2rem; margin-bottom: 1.5rem; transition: 0.3s; cursor: pointer; position: relative; }
        .upload-box:hover { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        button { background: var(--primary); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; transition: 0.3s; }
        button:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; background: #064e3b; color: #34d399; border-radius: 99px; font-size: 0.8rem; margin-bottom: 1rem; }
        .hash-box { background: #0f172a; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #cbd5e1; word-break: break-all; border: 1px solid #334155; margin: 1rem 0; }
        .footer { margin-top: 2rem; font-size: 0.8rem; color: #64748b; }
        a { color: var(--primary); text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <div class="footer">Powered by Polygon Blockchain & Node.js</div>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlTemplate(`
        <h1>TrustChain Noter</h1>
        <p>Dosyalarınızı Blockchain gücüyle sonsuza kadar mühürleyin. Değiştirilemez, silinemez.</p>
        <form action="/muhurle" method="post" enctype="multipart/form-data">
            <div class="upload-box">
                <span>📂 Dosyayı Buraya Sürükle veya Seç</span>
                <input type="file" name="belge" required>
            </div>
            <button type="submit">🔒 BLOCKCHAIN'E MÜHÜRLE</button>
        </form>
    `));
});

app.post('/muhurle', upload.single('belge'), async (req, res) => {
    try {
        if (!req.file) return res.send(htmlTemplate(`<h3>❌ Dosya Seçilmedi</h3><a href='/'>Geri Dön</a>`));
        
        // Yükleme ekranı (Basitçe bekletiyoruz gibi düşün, gerçekte loading spinner eklenebilir)
        const hash = hashHesapla(req.file.path);
        const txHash = await blockchainKayit(hash);
        fs.unlinkSync(req.file.path);

        res.send(htmlTemplate(`
            <div class="badge">✅ İŞLEM BAŞARILI</div>
            <h2>Dosyanız Mühürlendi!</h2>
            <p>Bu dosyanın dijital parmak izi (Hash) blokzincirine başarıyla işlendi.</p>
            
            <div class="hash-box">${hash}</div>
            
            <a href="https://amoy.polygonscan.com/tx/${txHash}" target="_blank">
                <button>📜 Sertifikayı Görüntüle</button>
            </a>
            <br><br>
            <a href="/" style="font-size:0.9rem; color:#94a3b8">Yeni İşlem Yap</a>
        `));
    } catch (error) {
        console.error(error);
        res.send(htmlTemplate(`
            <h2 style="color:#ef4444">❌ Bir Hata Oluştu</h2>
            <p>${error.message}</p>
            <a href="/"><button style="background:#334155">Tekrar Dene</button></a>
        `));
    }
});

app.listen(PORT, () => {
    console.log(`TrustChain Yayında: http://localhost:${PORT}`);
});
