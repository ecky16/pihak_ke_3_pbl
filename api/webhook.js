const axios = require('axios');

// KONFIGURASI
const TELEGRAM_TOKEN = 'ISI_TOKEN_BOT_DI_SINI'; // Ganti dengan token dari BotFather
const CHANNEL_ID = '-1003759185457'; // ID Channel Database Foto
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { message, edited_message } = req.body;
  
  // Ambil pesan (bisa pesan baru atau update Live Location)
  const msg = message || edited_message;
  if (!msg) return res.status(200).send('OK');

  const chatId = msg.chat.id;
  const nama = msg.from.first_name;

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

      // Balas hanya jika ini pesan baru (bukan update live location agar tidak spam)
      if (message && message.location) {
        return res.status(200).json({ 
          method: 'sendMessage', 
          chat_id: chatId, 
          text: '📍 Lokasi tercatat. Silakan lanjut survey!' 
        });
      }
      return res.status(200).send('OK');
    }

    // 2. LOGIKA TERIMA FOTO
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      const caption = msg.caption || 'Laporan Lapangan';

      // Forward ke Channel
      const forwardRes = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        chat_id: CHANNEL_ID,
        photo: photo.file_id,
        caption: `User: ${nama}\nKet: ${caption}`
      });

      const messageId = forwardRes.data.result.message_id;
      const cleanChannelId = CHANNEL_ID.replace('-100', '');
      const photoUrl = `https://t.me/c/${cleanChannelId}/${messageId}`;

      // Kirim ke Google Sheets (Koordinat 0 dulu, nanti teknisi kirim lokasi)
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
        text: '✅ Foto terkirim! Sekarang klik "Share Location" agar titik laporan ini masuk ke Map.' 
      });
    }

  } catch (err) {
    console.error('Error:', err.message);
  }

  res.status(200).send('OK');
};
