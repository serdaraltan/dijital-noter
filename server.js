const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { ethers } = require("ethers");

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- GÜVENLİK ---
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const PROVIDER_URL = process.env.RPC_URL || "https://polygon-rpc.com/";
const PORT = process.env.PORT || 3001;

// --- FONKSİYONLAR ---
function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function stampToBlockchain(hash) {
    if (!PRIVATE_KEY) throw new Error("Wallet Private Key missing!");
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const feeData = await provider.getFeeData();
    
    const tx = await wallet.sendTransaction({
        to: wallet.address,
        value: 0,
        data: '0x' + hash,
        gasPrice: feeData.gasPrice 
    });
    
    await tx.wait(); // İşte burası zaman alıyor (Blockchain onayı)
    return tx.hash;
}

// --- HTML TASARIMI (YÜKLENİYOR EKRANI EKLENDİ) ---
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyFileSeal | Blockchain Notary</title>
    <style>
        :root { --primary: #3b82f6; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; }
        body { margin: 0; font-family: sans-serif; background: var(--bg); color: var(--text); }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
        
        /* Loading Overlay Stilleri */
        #loadingOverlay {
            display: none; /* Başlangıçta gizli */
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.9); z-index: 9999;
            justify-content: center; align-items: center; flex-direction: column;
            text-align: center;
        }
        .spinner {
            width: 50px; height: 50px; border: 5px solid #334155;
            border-top: 5px solid var(--primary); border-radius: 50%;
            animation: spin 1s linear infinite; margin-bottom: 1rem;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Mevcut Stiller */
        .header { text-align: center; margin-bottom: 2rem; }
        .logo { font-size: 2rem; font-weight: 800; color: var(--primary); }
        .card { background: var(--card); padding: 2rem; border-radius: 1rem; text-align: center; border: 1px solid #334155; }
        .upload-area { border: 2px dashed #475569; padding: 3rem; margin-bottom: 1rem; position: relative; cursor: pointer; }
        .upload-area:hover { border-color: var(--primary); background: rgba(59,130,246,0.1); }
        input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        button.cta { background: var(--primary); color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; cursor: pointer; width: 100%; }
        
        /* Sonuç Ekranı Stilleri */
        .hash-box { background: #020617; padding: 1rem; word-break: break-all; border-radius: 0.5rem; margin: 1rem 0; font-family: monospace; border: 1px solid #475569; }
        a { color: var(--primary); text-decoration: none; }
    </style>
    <script>
        function showLoading() {
            // Dosya seçilmiş mi kontrol et
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput.files.length > 0) {
                document.getElementById('loadingOverlay').style.display = 'flex';
            }
        }
    </script>
</head>
<body>
    <div id="loadingOverlay">
        <div class="spinner"></div>
        <h2 style="color: white;">Processing...</h2>
        <p style="color: #94a3b8;">Uploading file, calculating hash, and writing to Blockchain.<br>This may take up to 30 seconds. Please wait.</p>
    </div>

    <div class="container">
        <div class="header">
            <div class="logo">MyFileSeal</div>
            <p>Immutable Proof of Existence on Polygon Network</p>
        </div>

        ${content}
        
        <div style="text-align:center; margin-top:3rem; color:#475569; font-size:0.8rem;">
            Powered by Polygon Mainnet & Render
        </div>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlTemplate(`
        <div class="card">
            <form action="/seal" method="post" enctype="multipart/form-data" onsubmit="showLoading()">
                <div class="upload-area">
                    <span style="font-size:3rem">📂</span>
                    <h3>Click to Upload File</h3>
                    <p style="color:#94a3b8">Max 10MB</p>
                    <input type="file" name="document" required>
                </div>
                <button type="submit" class="cta">🔒 Seal on Blockchain (Free)</button>
            </form>
        </div>
    `));
});

app.post('/seal', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.send(htmlTemplate(`<h3>❌ No file selected.</h3><a href='/'>Try Again</a>`));
        
        const hash = calculateHash(req.file.path);
        const txHash = await stampToBlockchain(hash);
        fs.unlinkSync(req.file.path);

        const scanUrl = `https://polygonscan.com/tx/${txHash}`;

        res.send(htmlTemplate(`
            <div class="card">
                <h2 style="color:#34d399">✅ SUCCESS!</h2>
                <p>Your file has been permanently sealed.</p>
                <div class="hash-box">${hash}</div>
                <a href="${scanUrl}" target="_blank">
                    <button class="cta" style="background:#4f46e5">📜 View Certificate</button>
                </a>
                <br><br>
                <a href="/">Seal Another File</a>
            </div>
        `));
    } catch (error) {
        console.error(error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.send(htmlTemplate(`
            <div class="card">
                <h2 style="color:#ef4444">❌ Error</h2>
                <p>${error.message}</p>
                <a href="/"><button class="cta" style="background:#334155">Try Again</button></a>
            </div>
        `));
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
