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
    const t = copy[language()] || copy.en;
    addMessage(text, 'user'); input.value = ''; setBusy(true);
    const thinking = addMessage(t.thinking, 'assistant');
    try {
      const data = await requestAnswer({ message: text, history, language: detectLanguage(text), webSearch });
      thinking.textContent = data.answer;
      if (data.ticketIntent) {
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
