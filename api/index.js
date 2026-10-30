const axios = require('axios');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL_ID = '-1003759185457';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';
const WEB_APP_URL = 'https://pihak-ke-3-pbl.vercel.app/gamas.html'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(200).send('OK');
    const { message, edited_message } = req.body;
    const msg = message || edited_message;
    if (!msg) return res.status(200).send('OK');

    const chatId = msg.chat.id.toString();
    const text = msg.text || "";

    try {
        // 1. CEK WHITELIST
        const checkUser = await axios.post(GAS_URL, { chatId: chatId, action: 'check_user' });
        
        if (checkUser.data.status === 'unauthorized') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: "⚠️ **Akses Ditolak!**\n\nID Anda (" + chatId + ") tidak terdaftar."
            });
        }

        const namaTeknisi = checkUser.data.nama || msg.from.first_name || "Rekan Teknisi";

        // --- FITUR BARU: MENU PANDUAN ---
        if (text === '/panduan' || text === '📖 PANDUAN') {
            const panduanTeks = 
                `📖 **PANDUAN PENGGUNAAN SIGAP**\n\n` +
                `⚙️ **A. PERSIAPAN HP (WAJIB)**\n` +
                `1. Matikan mode **Hemat Baterai**.\n` +
                `2. Set Izin Lokasi Telegram ke **'Selalu Izinkan'**.\n` +
                `3. Pastikan GPS Akurat (Cek di Google Maps).\n\n` +
                `▶️ **B. CARA MULAI (START)**\n` +
                `1. Klik **MULAI SURVEY** (Cukup 1x).\n` +
                `2. Kirim **Live Location** durasi **8 JAM**.\n` +
                `3. **DIAM DI TEMPAT** sampai Bot membalas status **ON**.\n\n` +
                `📸 **C. CARA KIRIM FOTO (PENTING!)**\n` +
                `1. Berhenti total, jepret foto, lalu klik kirim.\n` +
                `2. **JANGAN BERGERAK** dulu saat upload foto.\n` +
                `3. Tunggu balasan ketik keterangan, baru boleh jalan lagi.\n\n` +
                `⚠️ *Peringatan: Berpindah tempat saat upload foto bikin koordinat meleset!*`;

            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: panduanTeks, parse_mode: 'Markdown'
            });
        }

        // 2. MENU START / KEMBALI
        if (text === '/start' || text === 'Kembali') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: `Selamat Datang **${namaTeknisi}**!\n\nKlik **🚀 MULAI SURVEY** untuk monitoring.\nKlik **📖 PANDUAN** untuk cara setting lokasi akurat.`,
                reply_markup: {
                    keyboard: [
                        [{ text: "🚀 MULAI SURVEY", request_location: true }],
                        [{ text: "⚠️ LAPOR GAMAS", web_app: { url: WEB_APP_URL } }, { text: "📖 PANDUAN" }],
                        [{ text: "🏁 SELESAI" }]
                    ],
                    resize_keyboard: true
                }, parse_mode: 'Markdown'
            });
        }

        // --- LOGIKA PILIHAN MODE ---
        if (text === '📸 FOTO SURVEY' || text === '💡 FOTO USULAN') {
            const mode = text.includes('USULAN') ? 'Usulan' : 'Survey';
            await axios.post(GAS_URL, { chatId, action: 'set_mode', mode: mode });
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: `✅ Mode **${mode.toUpperCase()}** aktif!\n\nSilakan jepret foto. **Ingat: Jangan bergerak sampai upload selesai!**`,
                parse_mode: 'Markdown'
            });
        }

        // 3. TERIMA LIVE LOCATION
        if (msg.location) {
            axios.post(GAS_URL, {
                chatId: chatId, lat: msg.location.latitude, lon: msg.location.longitude,
                action: message ? 'start_survey' : 'tracking'
            }).catch(e => console.error(e.message));
            
            if (message) {
                return res.status(200).json({
                    method: 'sendMessage', chat_id: chatId,
                    text: `✅ **Survey Aktif!**\n\n**PENTING:** Klik ikon 📎 > Location > **Share My Live Location 8 Hours**.\n\nJika bingung klik **📖 PANDUAN**.`,
                    reply_markup: {
                        keyboard: [
                            [{ text: "📸 FOTO SURVEY" }, { text: "💡 FOTO USULAN" }],
                            [{ text: "📖 PANDUAN" }, { text: "🏁 SELESAI" }]
                        ],
                        resize_keyboard: true
                    }, parse_mode: 'Markdown'
                });
            }
            return res.status(200).send('OK');
        }

        // 5. TERIMA FOTO
        if (msg.photo) {
            const statusRes = await axios.post(GAS_URL, { chatId, action: 'check_status_detail' });
            
            if (statusRes.data.status === 'WAIT_LIVE') {
                return res.status(200).json({
                    method: 'sendMessage', chat_id: chatId,
                    text: '🚫 **Foto Ditolak!**\n\nAktifkan **Live Location (8 Jam)** dulu mas.'
                });
            }
            
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            try {
                // Tampilkan pesan loading biar teknisi stay
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: chatId, text: '📸 *Foto sedang diupload... JANGAN BERGERAK DULU!*', parse_mode: 'Markdown'
                });

                const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
                    chat_id: CHANNEL_ID, photo: photoId, caption: `Laporan dari: ${namaTeknisi}`
                });
                const msgIdFromChannel = forward.data.result.message_id;
                const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100', '')}/${msgIdFromChannel}`;
                
                await axios.post(GAS_URL, { chatId, foto: photoUrl, action: 'temp_photo' });
                
                return res.status(200).json({ 
                    method: 'sendMessage', chat_id: chatId, 
                    text: `✅ **Foto Terkirim!**\n\nSilakan masukkan **Keterangan Temuan**:`,
                    reply_markup: { force_reply: true }
                });
            } catch (error) {
                return res.status(200).json({
                    method: 'sendMessage', chat_id: chatId, text: '❌ **Gagal upload!** Coba lagi.'
                });
            }
        }

        // 6. TERIMA KETERANGAN TEKS
        if (text && !text.includes('/') && !['🏁 SELESAI','📸 FOTO SURVEY','💡 FOTO USULAN','Kembali','📖 PANDUAN'].includes(text)) {
            const responseMsg = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId, text: '⏳ Menyimpan data...'
            });
            const messageId = responseMsg.data.result.message_id;
            try {
                await axios.post(GAS_URL, { chatId, keterangan: text, action: 'update_keterangan' });
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
                    chat_id: chatId, message_id: messageId,
                    text: `✅ **Data Tersimpan!**\n\nKeterangan: "${text}"\n\nSilakan lanjut patroli. 🚀`
                });
            } catch (err) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
                    chat_id: chatId, message_id: messageId, text: `❌ Gagal menyimpan!`
                });
            }
            return res.status(200).send('OK');
        }

        // 7. SELESAI
        if (text === '🏁 SELESAI') {
            axios.post(GAS_URL, { chatId, action: 'stop_survey' }).catch(e => console.error(e.message));
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: 'Tugas Selesai! ✅\n\nSistem berhenti mencatat lokasi. Matikan live location agar hemat baterai.',
                reply_markup: {
                    keyboard: [
                        [{ text: "🚀 MULAI SURVEY", request_location: true }],
                        [{ text: "⚠️ LAPOR GAMAS", web_app: { url: WEB_APP_URL } }, { text: "📖 PANDUAN" }]
                    ],
                    resize_keyboard: true
                }
            });
        }
    } catch (e) {
        console.error(e.message);
    }
    res.status(200).send('OK');
};
