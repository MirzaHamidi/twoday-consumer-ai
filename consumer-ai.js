(function () {
  let root = document.querySelector('[data-consumer-ai]');
  if (!root) {
    root = document.createElement('aside');
    root.className = 'consumer-ai';
    root.dataset.consumerAi = '';
    root.setAttribute('aria-label', 'ToDo Assistant');
    root.innerHTML = `<button class="consumer-ai-launcher" type="button" data-ai-toggle aria-expanded="false" aria-controls="consumer-ai-panel" title="Open ToDo Assistant"><img src="assets/mascotwht.png" alt="Toto, ToDo Assistant"></button><section class="consumer-ai-panel" id="consumer-ai-panel" hidden><header class="consumer-ai-header"><div><p class="eyebrow" data-ai-label="eyebrow">Twoday Studio</p><h2 data-ai-label="title">ToDo Assistant</h2></div><button class="consumer-ai-close" type="button" data-ai-toggle aria-label="Close AI">×</button></header><div class="consumer-ai-messages" data-ai-messages aria-live="polite"><p class="consumer-ai-message is-assistant" data-ai-welcome>Ask about our games, studio, or publishing.</p></div><form class="consumer-ai-form" data-ai-form><label class="sr-only" for="consumer-ai-input" data-ai-label="inputLabel">Message</label><textarea id="consumer-ai-input" data-ai-input rows="2" maxlength="4000" required placeholder="Ask ToDo Assistant..."></textarea><div class="consumer-ai-actions"><button class="consumer-ai-search" type="button" data-ai-search aria-pressed="false" title="Toggle web search">⌕ <span data-ai-label="search">Web search</span></button><button class="button button-primary consumer-ai-send" type="submit"><span data-ai-label="send">Send</span></button></div></form></section>`;
    document.body.appendChild(root);
  }

  // The AI service is a separate Bunny container; keep this overridable for staging.
  const endpoint = window.TWODAY_AI_ENDPOINT || 'https://ai.twodaystudio.com/api/ai/chat';
  const fallbackEndpoint = 'https://mc-wvgsibkmje.bunny.run/api/ai/chat';
  const launcher = root.querySelector('[data-ai-toggle]');
  const panel = root.querySelector('#consumer-ai-panel');
  const form = root.querySelector('[data-ai-form]');
  const input = root.querySelector('[data-ai-input]');
  const messages = root.querySelector('[data-ai-messages]');
  const searchButton = root.querySelector('[data-ai-search]');
  let webSearch = false;
  let history = [];
  let ticketFlow = null;


  const copy = {
    en: { eyebrow: 'Twoday Studio', title: 'ToDo Assistant', welcome: 'Ask about our games, studio, or publishing.', inputLabel: 'Message', placeholder: 'Ask ToDo Assistant...', search: 'Web search', send: 'Send', thinking: 'Thinking…', error: 'The AI is unavailable right now. Please try again.' },
    tr: { eyebrow: 'Twoday Studio', title: 'ToDo Assistant', welcome: 'Oyunlarımızı, stüdyomuzu veya yayıncılığı sorabilirsiniz.', inputLabel: 'Mesaj', placeholder: 'ToDo Assistant’a sorun...', search: 'Web araması', send: 'Gönder', thinking: 'Düşünüyor…', error: 'AI şu anda kullanılamıyor. Lütfen tekrar deneyin.' },
    ar: { eyebrow: 'Twoday Studio', title: 'مساعد ToDo', welcome: 'اسأل عن ألعابنا أو الاستوديو أو النشر.', inputLabel: 'الرسالة', placeholder: 'اسأل مساعد ToDo...', search: 'بحث على الويب', send: 'إرسال', thinking: 'يفكر…', error: 'الذكاء الاصطناعي غير متاح الآن. حاول مرة أخرى.' },
    zh: { eyebrow: 'Twoday Studio', title: 'ToDo 助手', welcome: '可以询问我们的游戏、工作室或发行合作。', inputLabel: '消息', placeholder: '向 ToDo 助手提问…', search: '网页搜索', send: '发送', thinking: '思考中…', error: 'AI 暂时不可用，请稍后再试。' }
  };

  function detectLanguage(text) {
    const value = String(text || '');
    if (/[؀-ۿ]/u.test(value)) return 'ar';
    if (/[぀-ヿ㐀-鿿]/u.test(value)) return 'zh';
    if (/[çğıİöşüÇĞIÖŞÜ]/u.test(value)) return 'tr';
    return language();
  }

  function language() { return localStorage.getItem('twoday-lang') || document.documentElement.lang || 'en'; }
  function setCopy() {
    const t = copy[language()] || copy.en;
    root.querySelectorAll('[data-ai-label]').forEach((el) => { const key = el.dataset.aiLabel; if (t[key]) el.textContent = t[key]; });
    root.querySelector('[data-ai-welcome]').textContent = t.welcome;
    input.placeholder = t.placeholder;
    input.setAttribute('aria-label', t.inputLabel);
  }
  function toggle(open) { panel.hidden = !open; panel.setAttribute('aria-hidden', String(!open)); launcher.setAttribute('aria-expanded', String(open)); if (open) input.focus(); }
  function addMessage(text, role) { const item = document.createElement('p'); item.className = `consumer-ai-message is-${role}`; item.textContent = text; messages.appendChild(item); messages.scrollTop = messages.scrollHeight; return item; }
  function setBusy(busy) { form.querySelector('[type="submit"]').disabled = busy; input.disabled = busy; }
  async function requestAnswer(payload) {
    const endpoints = endpoint === fallbackEndpoint ? [endpoint] : [endpoint, fallbackEndpoint];
    let lastError;
    for (const url of endpoints) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (response.ok && data.answer) return data;
        lastError = new Error(data.error || `AI request failed (${response.status})`);
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('AI request failed');
  }

  function ticketText(language, key) {
    const prompts = {
      en: { email: 'Please provide your email address.', game: 'Which area is affected? Choose One Two Dice, Hoop Pong, or Website.', issue: 'What is the issue? You can describe it freely, or say bug report, gameplay question, account or purchase, or feedback.', device: 'Which device or platform are you using? You can say Android, iPhone, browser, or skip.', details: 'Please add any extra details that could help us investigate.', done: 'I filled in the support form for you. Complete the security check and press Send Ticket.' },
      tr: { email: 'Lütfen e-posta adresinizi yazın.', game: 'Sorun hangi bölümle ilgili? One Two Dice, Hoop Pong veya Website yazabilirsiniz.', issue: 'Sorun nedir? Özgürce anlatabilir veya bug, oynanış sorusu, hesap/satın alma ya da geri bildirim diyebilirsiniz.', device: 'Hangi cihaz veya platformu kullanıyorsunuz? Android, iPhone, tarayıcı yazabilir ya da geçebilirsiniz.', details: 'İncelememize yardımcı olacak başka ayrıntı var mı?', done: 'Destek formunu sizin için doldurdum. Güvenlik doğrulamasını tamamlayıp Send Ticket’a basın.' },
      ar: { email: 'من فضلك اكتب بريدك الإلكتروني.', game: 'ما الجزء المتأثر؟ اختر One Two Dice أو Hoop Pong أو الموقع.', issue: 'ما المشكلة؟ يمكنك وصفها بحرية أو اختيار بلاغ خطأ أو سؤال عن اللعب أو الحساب والشراء أو ملاحظات.', device: 'ما الجهاز أو المنصة التي تستخدمها؟ اكتب Android أو iPhone أو المتصفح، أو اكتب تخطي.', details: 'هل تريد إضافة أي تفاصيل أخرى تساعدنا في التحقيق؟', done: 'ملأت نموذج الدعم من أجلك. أكمل التحقق الأمني واضغط إرسال التذكرة.' },
      zh: { email: '请提供您的电子邮箱。', game: '问题涉及哪一部分？请选择 One Two Dice、Hoop Pong 或网站。', issue: '问题是什么？可以自由描述，也可以说错误报告、玩法问题、账户或购买、反馈。', device: '您使用什么设备或平台？可以说 Android、iPhone、浏览器，或输入跳过。', details: '还有其他有助于我们调查的细节吗？', done: '我已为您填写支持表单。完成安全验证后，请点击发送工单。' }
    };
    return (prompts[language] || prompts.en)[key];
  }
  function prepareTicketForm() {
    const support = document.querySelector('[data-form-type="support"]');
    if (!support) return false;
    const fields = { email: ticketFlow.email, game: ticketFlow.game, issue: ticketFlow.issue, device: ticketFlow.device, message: ticketFlow.details };
    Object.entries(fields).forEach(([name, value]) => { const field = support.elements.namedItem(name); if (field) field.value = value; });
    support.scrollIntoView({ behavior: 'smooth', block: 'center' });
    support.querySelector('[data-turnstile]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  async function continueTicketFlow(text) {
    const lang = ticketFlow.language;
    const value = text.trim();
    if (ticketFlow.stage === 'email') {
      if (!/^\S+@\S+\.\S+$/.test(value)) { addMessage(ticketText(lang, 'email'), 'assistant'); return; }
      ticketFlow.email = value; ticketFlow.stage = 'game'; addMessage(ticketText(lang, 'game'), 'assistant'); return;
    }
    if (ticketFlow.stage === 'game') {
      const normalized = value.toLowerCase();
      ticketFlow.game = /one\s*two|dice|zar/i.test(normalized) ? 'One Two Dice' : /hoop|pong/i.test(normalized) ? 'Hoop Pong' : 'Website';
      ticketFlow.stage = 'issue'; addMessage(ticketText(lang, 'issue'), 'assistant'); return;
    }
    if (ticketFlow.stage === 'issue') { ticketFlow.issue = value.slice(0, 100); ticketFlow.stage = 'device'; addMessage(ticketText(lang, 'device'), 'assistant'); return; }
    if (ticketFlow.stage === 'device') { ticketFlow.device = /skip|geç|تخطي|跳过/i.test(value) ? 'Not provided' : value.slice(0, 200); ticketFlow.stage = 'details'; addMessage(ticketText(lang, 'details'), 'assistant'); return; }
    ticketFlow.details = value.slice(0, 4000);
    try { prepareTicketForm(); addMessage(ticketText(lang, 'done'), 'assistant'); ticketFlow = null; }
    catch { addMessage(lang === 'tr' ? 'Talep gönderilemedi. Lütfen tekrar deneyin.' : 'The ticket could not be sent. Please try again.', 'assistant'); }
  }

  launcher.addEventListener('click', () => toggle(panel.hidden));
  root.querySelector('.consumer-ai-close').addEventListener('click', () => toggle(false));
  searchButton.addEventListener('click', () => { webSearch = !webSearch; searchButton.setAttribute('aria-pressed', String(webSearch)); searchButton.dataset.enabled = String(webSearch); searchButton.classList.toggle('is-active', webSearch); });
  document.querySelector('#lang-select')?.addEventListener('change', setCopy);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!form.querySelector('[type="submit"]').disabled) form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (ticketFlow) { addMessage(text, 'user'); input.value = ''; await continueTicketFlow(text); return; }
    const t = copy[language()] || copy.en;
    addMessage(text, 'user'); input.value = ''; setBusy(true);
    const thinking = addMessage(t.thinking, 'assistant');
    try {
      const data = await requestAnswer({ message: text, history, language: detectLanguage(text), webSearch });
      thinking.textContent = data.answer;
      if (data.ticketIntent) {
        ticketFlow = { stage: 'email', language: detectLanguage(text) };
        addMessage(ticketText(ticketFlow.language, 'email'), 'assistant');
        const ticket = document.createElement('button');
        ticket.type = 'button'; ticket.className = 'consumer-ai-ticket'; ticket.textContent = language() === 'tr' ? 'Destek formunu aç' : language() === 'ar' ? 'فتح نموذج الدعم' : language() === 'zh' ? '打开支持表单' : 'Open support form';
        ticket.addEventListener('click', () => document.querySelector('[data-form-type="support"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        messages.appendChild(ticket);
      }
      history = [...history, { role: 'user', content: text }, { role: 'assistant', content: data.answer }].slice(-12);
    } catch (error) { thinking.textContent = t.error; console.error(error); }
    finally { setBusy(false); input.focus(); }
  });
  setCopy();
})();
