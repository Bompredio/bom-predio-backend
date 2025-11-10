// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 🔗 Supabase client (Service Role) — uso exclusivo do backend
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 🤖 OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// ✅ Health check
app.get('/healthz', (req, res) => res.json({ ok: true, message: 'API da Bom Prédio está online!' }));

// 🌐 Rota raiz amigável (mostra status da API)
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Bom Prédio - API</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f5f7fa;
            color: #101841;
            padding: 30px;
          }
          .box {
            background: #fff;
            border-radius: 8px;
            padding: 25px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
            max-width: 720px;
            margin: 0 auto;
          }
          h1 { color: #101841; }
          a {
            color: #101841;
            text-decoration: none;
            font-weight: 600;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Bom Prédio — API</h1>
          <p>🚀 Backend operacional com sucesso!</p>
          <ul>
            <li><a href="/healthz">/healthz</a> — verificar status</li>
            <li><a href="/condominios">/condominios</a> — listar condomínios</li>
            <li><a href="/docs/gerar-ata">/docs/gerar-ata</a> — gerar ata (POST)</li>
          </ul>
          <p><em>Use um cliente HTTP (como Postman ou cURL) para testar os endpoints POST.</em></p>
        </div>
      </body>
    </html>
  `);
});

/* 🏢 Condominios */
app.get('/condominios', async (req, res) => {
  try {
    const { data, error } = await supabase.from('condominios').select('*');
    if (error) throw error;
    res.json({ condominios: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/condominios', async (req, res) => {
  try {
    const payload = req.body;
    const { data, error } = await supabase.from('condominios').insert([payload]).select().single();
    if (error) throw error;
    res.json({ condominio: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* 🗳️ Assembleias */
app.get('/condominios/:id/assembleias', async (req, res) => {
  const condominio_id = req.params.id;
  try {
    const { data, error } = await supabase.from('assembleias').select('*').eq('condominio_id', condominio_id);
    if (error) throw error;
    res.json({ assembleias: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/condominios/:id/assembleias', async (req, res) => {
  const condominio_id = req.params.id;
  try {
    const { pauta, start_at, end_at } = req.body;
    const rtc_room = `bom-predio-${uuidv4().slice(0, 8)}`;
    const payload = { condominio_id, pauta, start_at, end_at, rtc_room };
    const { data, error } = await supabase.from('assembleias').insert([payload]).select().single();
    if (error) throw error;
    res.json({ assembleia: data, jitsi_room: `https://meet.jit.si/${rtc_room}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* 🧾 ERP — Lançamentos */
app.get('/erp/:condominio_id/lancamentos', async (req, res) => {
  try {
    const { condominio_id } = req.params;
    const { data, error } = await supabase.from('lancamentos').select('*').eq('condominio_id', condominio_id);
    if (error) throw error;
    res.json({ lancamentos: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/erp/:condominio_id/lancamentos', async (req, res) => {
  try {
    const { condominio_id } = req.params;
    const { descricao, valor, data_lancamento } = req.body;
    const payload = { condominio_id, descricao, valor, data_lancamento };
    const { data, error } = await supabase.from('lancamentos').insert([payload]).select().single();
    if (error) throw error;
    res.json({ lancamento: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* 🧠 Gerar Ata (OpenAI + PDF-Lib) */
app.post('/docs/gerar-ata', async (req, res) => {
  try {
    const { assembleia_id, transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'O campo transcript é obrigatório.' });

    const prompt = `
      Você é um assistente que gera atas formais de assembleias condominiais.
      Escreva uma ata concisa e formal, em português, com:
      - Título, data, participantes (se houver), pautas, decisões e resultados.
      Texto: ${transcript}
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um assistente especializado em atas formais.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800
    });

    const ataText = completion.choices?.[0]?.message?.content || 'Erro ao gerar ata.';

    // Gerar PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;

    let y = 800;
    page.drawText('Ata da Assembleia', { x: 50, y, size: 16, font });
    y -= 28;
    ataText.split('\n').forEach(line => {
      page.drawText(line.trim(), { x: 50, y, size: fontSize, font });
      y -= 16;
    });

    const pdfBytes = await pdfDoc.save();
    const fileName = `ata_${assembleia_id || 'sem_id'}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'documents')
      .upload(fileName, Buffer.from(pdfBytes), { contentType: 'application/pdf' });

    if (uploadError) throw uploadError;

    const { data: publicURL } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'documents')
      .getPublicUrl(fileName);

    await supabase.from('documentos').insert([{ tipo: 'ata', file_path: fileName, signed: false }]);

    res.json({ ata_text: ataText, pdf_url: publicURL.publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
  }
});

// 🚀 Start do servidor
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Bom Prédio API rodando na porta ${port}`));
