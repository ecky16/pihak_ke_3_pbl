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
  // 1. CEK APAKAH USER TERDAFTAR (WHITELIST)
  // Kita panggil GAS untuk cek apakah ID ini ada di db_subscriber
  const checkUser = await axios.post(GAS_URL, { 
    chatId: chatId, 
    action: 'check_user' 
  });

  if (checkUser.data.status === 'unauthorized') {
    // Jika tidak terdaftar, hentikan proses dan beri tahu user
    return res.status(200).json({
      method: 'sendMessage',
      chat_id: chatId,
      text: "⚠️ **Akses Ditolak!**\n\nID Anda (" + chatId + ") tidak terdaftar dalam database tim Survey Pihak ke 3. Silakan hubungi Mas Ecky untuk pendaftaran."
    });
  }

  try {
    // MENU UTAMA / START
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

    // TERIMA LOKASI (START / TRACKING)
    if (msg.location) {
      await axios.post(GAS_URL, { chatId, lat: msg.location.latitude, lon: msg.location.longitude, action: message ? 'start_survey' : 'tracking' });
      if (message) {
        return res.status(200).json({
          method: 'sendMessage', chat_id: chatId,
          text: `✅ **Survey Aktif!**\n\n1. Pilih **'Share Live Location 8 Jam'** pada baris di atas.\n2. Jika ada temuan, klik ikon 📸 **Kamera** dan kirim foto.\n3. Masukkan keterangan setelah foto terkirim.`,
          reply_markup: { keyboard: [[{ text: "📸 KIRIM LAPORAN FOTO" }], [{ text: "🏁 SELESAI" }]], resize_keyboard: true },
          parse_mode: 'Markdown'
        });
      }
      return res.status(200).send('OK');
    }

    // TERIMA FOTO
  // 3. LOGIKA TERIMA FOTO + VALIDASI GPS
    if (msg.photo) {
      // Cek apakah lokasi ada (Telegram biasanya kirim lokasi bersamaan dengan foto jika GPS aktif)
      // Atau kita cek apakah mereka sudah kirim lokasi sebelumnya
      if (!msg.location && (!msg.reply_to_message || !msg.reply_to_message.location)) {
        return res.status(200).json({
          method: 'sendMessage',
          chat_id: chatId,
          text: '⚠️ **Laporan Ditolak!**\n\nGPS Anda tidak terdeteksi. Silakan klik tombol **🚀 MULAI SURVEY** (Live Location 8 Jam) terlebih dahulu sebelum mengirim foto agar posisi temuan tercatat di Map.',
          parse_mode: 'Markdown'
        });
      }

      const photoId = msg.photo[msg.photo.length - 1].file_id;
      const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { 
        chat_id: CHANNEL_ID, 
        photo: photoId, 
        caption: `Laporan Lapangan dari ID: ${chatId}` 
      });

      const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100','')}/${forward.data.result.message_id}`;
      
      await axios.post(GAS_URL, { chatId, foto: photoUrl, action: 'temp_photo' });
      return res.status(200).json({ 
        method: 'sendMessage', 
        chat_id: chatId, 
        text: '📸 **Foto diterima!**\n\nSilakan masukkan **keterangan temuan :**' 
      });
    }

    // TERIMA TEKS (KETERANGAN)
    if (text && !text.includes('/') && text !== '🏁 SELESAI' && text !== '📸 KIRIM LAPORAN FOTO') {
      await axios.post(GAS_URL, { chatId, keterangan: text, action: 'update_keterangan' });
      return res.status(200).json({ method: 'sendMessage', chat_id: chatId, text: '✅ Keterangan disimpan!' });
    }

    // SELESAI
 // 5. LOGIKA SELESAI SURVEY (GANTI BAGIAN INI)
    // LOGIKA SELESAI SURVEY
    if (text === '🏁 SELESAI') {
      await axios.post(GAS_URL, { chatId: chatId, action: 'stop_survey' });
      
      return res.status(200).json({
        method: 'sendMessage',
        chat_id: chatId,
        text: 'Tugas Selesai! ✅\n\nSistem sudah berhenti mencatat lokasi Anda.\n\n*Catatan:* Jika bar "Stop Sharing" tidak muncul, silakan matikan GPS HP sebentar agar baterai awet.',
        reply_markup: {
          keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }]],
          resize_keyboard: true
        },
        parse_mode: 'Markdown'
      });
    }

  } catch (e) { console.log(e.message); }
  res.status(200).send('OK');
};
