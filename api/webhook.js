const axios = require('axios');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL_ID = '-1003759185457';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';

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
                method: 'sendMessage',
                chat_id: chatId,
                text: "⚠️ **Akses Ditolak!**\n\nID Anda (" + chatId + ") tidak terdaftar. Hubungi Mas Ecky untuk pendaftaran."
            });
        }

        // 2. MENU START / KEMBALI
        if (text === '/start' || text === 'Kembali') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: `Selamat Datang di Sistem Survey Pihak ke 3.\n\nKlik **🚀 MULAI SURVEY** untuk mengaktifkan tracking lokasi.`,
                reply_markup: {
                    keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }], [{ text: "🏁 SELESAI" }]],
                    resize_keyboard: true
                }, parse_mode: 'Markdown'
            });
        }

        // 3. INSTRUKSI KIRIM FOTO
        if (text === '📸 KIRIM LAPORAN FOTO') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: 'Silakan klik ikon 📎 **Lampiran** lalu pilih 📸 **Kamera** untuk memotret temuan Anda.'
            });
        }

        // 4. TERIMA LOKASI (START / TRACKING)
        if (msg.location) {
            await axios.post(GAS_URL, { chatId, lat: msg.location.latitude, lon: msg.location.longitude, action: message ? 'start_survey' : 'tracking' });
            if (message) {
                return res.status(200).json({
                    method: 'sendMessage', chat_id: chatId,
                    text: `✅ **Survey Aktif!**\n\n**PENTING:** Klik ikon 📎 (Paperclip) > Location > **Share My Live Location for 8 Hours** agar jalur Anda terekam di Peta.`,
                    reply_markup: { keyboard: [[{ text: "📸 KIRIM LAPORAN FOTO" }], [{ text: "🏁 SELESAI" }]], resize_keyboard: true },
                    parse_mode: 'Markdown'
                });
            }
            return res.status(200).send('OK');
        }

        // 5. TERIMA FOTO (STRATEGI PERCAYA SAJA - TANPA BLOKIR)
        if (msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { 
                chat_id: CHANNEL_ID, 
                photo: photoId, 
                caption: `Laporan Lapangan dari ID: ${chatId}` 
            });
            const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100','')}/${forward.data.result.message_id}`;
            await axios.post(GAS_URL, { chatId, foto: photoUrl, action: 'temp_photo' });
            return res.status(200).json({ method: 'sendMessage', chat_id: chatId, text: '📸 **Foto diterima!**\n\nMasukkan keterangan temuan :' });
        }

        // 6. UPDATE KETERANGAN
        if (text && !text.includes('/') && text !== '🏁 SELESAI' && text !== '📸 KIRIM LAPORAN FOTO') {
            await axios.post(GAS_URL, { chatId, keterangan: text, action: 'update_keterangan' });
            return res.status(200).json({ method: 'sendMessage', chat_id: chatId, text: '✅ Keterangan disimpan!' });
        }

        // 7. SELESAI
        if (text === '🏁 SELESAI') {
            await axios.post(GAS_URL, { chatId, action: 'stop_survey' });
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: 'Tugas Selesai! ✅\n\nJangan lupa matikan Share Location di bar atas.',
                reply_markup: { keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }]], resize_keyboard: true }
            });
        }

    } catch (e) { console.error("Error:", e.message); }
    res.status(200).send('OK');
};
