const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { ethers } = require("ethers");

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- GÜVENLİK VE AYARLAR ---
// Artık şifreleri kodun içinden değil, Render'ın kasasından okuyoruz.
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const PROVIDER_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology/";
const PORT = process.env.PORT || 3001;

// --- FONKSİYONLAR ---
function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function stampToBlockchain(hash) {
    if (!PRIVATE_KEY) throw new Error("Wallet Private Key is missing in configurations!");
    
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // İşlem ücretini dinamik ayarla (Mainnet için önemli)
    const feeData = await provider.getFeeData();
    
    const tx = await wallet.sendTransaction({
        to: wallet.address,
        value: 0,
        data: '0x' + hash,
        gasPrice: feeData.gasPrice // Piyasaya göre ücret öde
    });
    
    await tx.wait();
    return tx.hash;
}

// --- HTML TASARIMI (FRONTEND) ---
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyFileSeal | Immutable Blockchain Proof</title>
    <meta name="description" content="Secure your documents, art, and ideas on the Polygon Blockchain. Forever.">
    <style>
        :root { --primary: #3b82f6; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; }
        body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
        
        /* Header */
        .header { text-align: center; margin-bottom: 3rem; padding-top: 2rem; }
        .logo { font-size: 2rem; font-weight: 800; background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -1px; }
        .subtitle { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; margin: 1rem auto; }

        /* Main Card */
        .card { background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); border: 1px solid #334155; text-align: center; }
        .upload-area { border: 2px dashed #475569; border-radius: 0.75rem; padding: 3rem 1.5rem; transition: 0.3s; cursor: pointer; position: relative; background: rgba(15, 23, 42, 0.3); }
        .upload-area:hover { border-color: var(--primary); background: rgba(59, 130, 246, 0.1); }
        .upload-icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
        input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        
        button.cta { background: var(--primary); color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; font-weight: 600; margin-top: 1.5rem; cursor: pointer; width: 100%; transition: 0.2s; }
        button.cta:hover { background: #2563eb; transform: translateY(-2px); }

        /* Sections */
        .section-title { margin-top: 4rem; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: #e2e8f0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
        .info-box { background: rgba(30, 41, 59, 0.5); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #334155; }
        .info-box h3 { margin-top: 0; color: var(--primary); font-size: 1.1rem; }
        .faq-item { margin-bottom: 1.5rem; }
        .faq-question { font-weight: 600; color: #e2e8f0; margin-bottom: 0.25rem; }
        .faq-answer { color: var(--text-muted); font-size: 0.95rem; }

        /* Result Styles */
        .success-badge { display: inline-block; padding: 0.25rem 1rem; background: #065f46; color: #34d399; border-radius: 99px; font-weight: 600; font-size: 0.9rem; margin-bottom: 1rem; }
        .hash-display { background: #020617; padding: 1rem; border-radius: 0.5rem; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #cbd5e1; word-break: break-all; border: 1px solid #475569; margin: 1.5rem 0; }
        
        footer { text-align: center; margin-top: 4rem; color: #475569; font-size: 0.85rem; padding-bottom: 2rem; }
        a { color: var(--primary); text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">MyFileSeal</div>
            <p class="subtitle">Timestamp your documents on the Blockchain. <br>Immutable proof of existence for creators, freelancers, and businesses.</p>
        </div>

        ${content}

        <div class="how-it-works">
            <h2 class="section-title">How It Works</h2>
            <div class="grid">
                <div class="info-box">
                    <h3>1. Upload</h3>
                    <p>Select any file (PDF, JPG, Doc). We calculate its unique digital fingerprint (Hash).</p>
                </div>
                <div class="info-box">
                    <h3>2. Timestamp</h3>
                    <p>We send this fingerprint to the Polygon Blockchain. Your file's content remains private.</p>
                </div>
                <div class="info-box">
                    <h3>3. Proof</h3>
                    <p>You get a permanent blockchain link proving you had this specific file at this specific time.</p>
                </div>
            </div>
        </div>

        <div class="faq">
            <h2 class="section-title">Frequently Asked Questions</h2>
            <div class="faq-item">
                <div class="faq-question">Do you store my files?</div>
                <div class="faq-answer">No. Never. We only calculate the "Hash" (fingerprint) on our server and delete the file immediately. Your secrets are safe.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question">Is this legally binding?</div>
                <div class="faq-answer">It serves as strong digital evidence (Proof of Existence) in courts worldwide, verifying that data existed at a point in time.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question">Can I change the file name?</div>
                <div class="faq-answer">Yes. Changing the file name does not change the cryptographic hash. But changing even one pixel or letter inside the file will break the proof.</div>
            </div>
        </div>

        <footer>
            &copy; 2025 MyFileSeal. Powered by Polygon Network. <br>
            <span style="opacity: 0.6">Currently in Beta - Free for limited time.</span>
        </footer>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlTemplate(`
        <div class="card">
            <form action="/seal" method="post" enctype="multipart/form-data">
                <div class="upload-area">
                    <span class="upload-icon">📂</span>
                    <h3>Drag & Drop or Click to Upload</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem">Max size: 10MB. We do not store your files.</p>
                    <input type="file" name="document" required>
                </div>
                <button type="submit" class="cta">🔒 Seal on Blockchain (Free)</button>
            </form>
        </div>
    `));
});

app.post('/seal', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.send(htmlTemplate(`<h3>❌ No file selected.</h3><a href='/'>Go Back</a>`));
        
        // Hash işlemi
        const hash = calculateHash(req.file.path);
        
        // Blockchain işlemi
        const txHash = await stampToBlockchain(hash);

        // Dosyayı sil
        fs.unlinkSync(req.file.path);

        // Polygonscan Linki (Mainnet mi Testnet mi kontrolü)
        // Eğer RPC_URL içinde 'amoy' geçiyorsa testnet linki ver, yoksa mainnet linki ver.
        const isTestnet = PROVIDER_URL.includes("amoy");
        const scanUrl = isTestnet 
            ? `https://amoy.polygonscan.com/tx/${txHash}` 
            : `https://polygonscan.com/tx/${txHash}`;

        res.send(htmlTemplate(`
            <div class="card">
                <div class="success-badge">✅ SUCCESS</div>
                <h2>Your File is Sealed!</h2>
                <p>The digital fingerprint has been permanently recorded.</p>
                
                <div class="hash-display">${hash}</div>
                
                <a href="${scanUrl}" target="_blank">
                    <button class="cta" style="background: #4f46e5;">📜 View Blockchain Certificate</button>
                </a>
                <br><br>
                <a href="/" style="color:var(--text-muted)">Seal Another File</a>
            </div>
        `));
    } catch (error) {
        console.error(error);
        if (req.file) fs.unlinkSync(req.file.path); // Hata olsa bile dosyayı sil
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
    console.log(`MyFileSeal is running on port ${PORT}`);
});
