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

// Supabase client (service role) - backend only
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

/**
 * Condominios
 */
app.get('/condominios', async (req, res) => {
  try {
    const { data, error } = await supabase.from('condominios').select('*');
    if (error) throw error;
    res.json({ condominios: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
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
    res.status(500).json({ error: err.message || err });
  }
});

/**
 * Assembleias
 */
app.get('/condominios/:id/assembleias', async (req, res) => {
  const condominio_id = req.params.id;
  try {
    const { data, error } = await supabase.from('assembleias').select('*').eq('condominio_id', condominio_id);
    if (error) throw error;
    res.json({ assembleias: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
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
    res.status(500).json({ error: err.message || err });
  }
});

app.post('/assembleias/:id/votar', async (req, res) => {
  try {
    const assembleia_id = req.params.id;
    const { usuario_id, escolha } = req.body;
    const { data, error } = await supabase.from('votos').insert([{ assembleia_id, usuario_id, escolha }]).select().single();
    if (error) throw error;
    res.json({ voto: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
  }
});

/**
 * ERP - lancamentos
 */
app.get('/erp/:condominio_id/lancamentos', async (req, res) => {
  try {
    const { condominio_id } = req.params;
    const { data, error } = await supabase.from('lancamentos').select('*').eq('condominio_id', condominio_id);
    if (error) throw error;
    res.json({ lancamentos: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
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
    res.status(500).json({ error: err.message || err });
  }
});

/**
 * Gerar ata: recebe { assembleia_id, transcript } — usa OpenAI para sintetizar e gera PDF
 */
app.post('/docs/gerar-ata', async (req, res) => {
  try {
    const { assembleia_id, transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });

    // 1) Pedir ao OpenAI uma ata concisa
    const prompt = `Você é um assistente que gera uma ata formal de assembleia. Gere uma ata concisa em português com:
- Título, data (se disponível), participantes (se mencionados), pauta, decisões e resultados de votação.
Use linguagem formal e breve. Transcrição: ${transcript}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Você é um assistente que gera atas formais.' }, { role: 'user', content: prompt }],
      max_tokens: 800
    });

    const ataText = completion.choices?.[0]?.message?.content || 'Ata gerada — conteúdo vazio.';

    // 2) Gerar PDF com PDF-Lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4-ish
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const lines = ataText.split('\n').map(l => l.trim()).filter(Boolean);
    let y = 800;
    page.drawText('Ata da Assembleia', { x: 50, y, size: 16, font });
    y -= 28;
    lines.forEach(line => {
      if (y < 40) {
        // new page
        y = 800;
        page = pdfDoc.addPage([595, 842]);
      }
      page.drawText(line, { x: 50, y, size: fontSize, font });
      y -= 16;
    });

    const pdfBytes = await pdfDoc.save();
    const fileName = `ata_${assembleia_id || 'unknown'}_${Date.now()}.pdf`;
    // 3) Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'documents')
      .upload(fileName, Buffer.from(pdfBytes), { contentType: 'application/pdf' });

    if (uploadError) throw uploadError;

    // 4) gerar URL pública (signed)
    const { data: publicURL } = supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'documents').getPublicUrl(fileName);

    // 5) salve metadados em tabela documentos
    await supabase.from('documentos').insert([{ condominio_id: null, tipo: 'ata', file_path: fileName, signed: false }]);

    res.json({ ata_text: ataText, pdf_url: publicURL.publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
  }
});

// Start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
