const axios = require('axios');

// KONFIGURASI MENGGUNAKAN ENVIRONMENT VARIABLES (AMAN)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL_ID = '-1003759185457'; 
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { message, edited_message } = req.body;
  const msg = message || edited_message;
  if (!msg) return res.status(200).send('OK');

  const chatId = msg.chat.id;
  const nama = msg.from.first_name || "Teknisi";

  try {
    // 1. LOGIKA TERIMA LOKASI (Termasuk Live Location)
    if (msg.location) {
      const { latitude, longitude } = msg.location;
      
      await axios.post(GAS_URL, {
        chatId: chatId,
        nama: nama,
        lat: latitude,
        lon: longitude,
        foto: '-',
        keterangan: 'Update Lokasi / Survey'
      });

      if (message && message.location) {
        return res.status(200).json({ 
          method: 'sendMessage', 
          chat_id: chatId, 
          text: `📍 Lokasi ${nama} tercatat. Lanjutkan survey!` 
        });
      }
      return res.status(200).send('OK');
    }

    // 2. LOGIKA TERIMA FOTO
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      const caption = msg.caption || 'Laporan Lapangan';

      const forwardRes = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        chat_id: CHANNEL_ID,
        photo: photo.file_id,
        caption: `User: ${nama}\nKet: ${caption}`
      });

      const messageId = forwardRes.data.result.message_id;
      const cleanChannelId = CHANNEL_ID.replace('-100', '');
      const photoUrl = `https://t.me/c/${cleanChannelId}/${messageId}`;

      await axios.post(GAS_URL, {
        chatId: chatId,
        nama: nama,
        lat: 0, 
        lon: 0,
        foto: photoUrl,
        keterangan: caption
      });

      return res.status(200).json({ 
        method: 'sendMessage', 
        chat_id: chatId, 
        text: '✅ Foto terkirim! Klik "Share Location" (Live Location) agar titik ini muncul di Map.' 
      });
    }

    // 3. MENU START
    if (msg.text === '/start') {
      return res.status(200).json({
        method: 'sendMessage',
        chat_id: chatId,
        text: `Halo ${nama}, gunakan tombol di bawah untuk lapor:`,
        reply_markup: {
          keyboard: [[{ text: "📍 Kirim Lokasi", request_location: true }]],
          resize_keyboard: true
        }
      });
    }

  } catch (err) {
    console.error('Error:', err.message);
  }

  res.status(200).send('OK');
};
