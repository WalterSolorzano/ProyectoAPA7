// create_blockmap.js - Creates the blockmap for the NSIS installer
// with retry logic for Windows Defender file locking

const path = require("path");
const fs = require("fs");

const installerPath = path.join(__dirname, "dist-electron-builder", "WordAPA7 Setup 1.0.35.exe");
const blockmapPath = installerPath + ".blockmap";

async function createBlockmapWithRetry() {
    const { buildBlockMap } = require("./node_modules/app-builder-lib/out/targets/blockmap/blockmap");
    
    const MAX_RETRIES = 8;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Delete stale blockmap first
            try { fs.unlinkSync(blockmapPath); } catch (_) {}
            
            console.log(`Attempt ${attempt}/${MAX_RETRIES}: Creating blockmap...`);
            const updateInfo = await buildBlockMap(installerPath, "gzip", blockmapPath);
            console.log("Blockmap created successfully!");
            console.log("SHA512:", updateInfo.sha512);
            console.log("Size:", updateInfo.size);
            console.log("Blocks:", updateInfo.blockMapData ? "yes" : "no");
            return;
        } catch (e) {
            console.error(`Attempt ${attempt} failed: ${e.message}`);
            if (attempt < MAX_RETRIES) {
                console.log(`Waiting 5 seconds before retry...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    console.error("All retries exhausted. Blockmap creation failed.");
    process.exit(1);
}

createBlockmapWithRetry();
