(function () {
  const root = document.querySelector('[data-consumer-ai]');
  if (!root) return;

  const endpoint = window.TWODAY_AI_ENDPOINT || '/api/ai/chat';
  const launcher = root.querySelector('[data-ai-toggle]');
  const panel = root.querySelector('#consumer-ai-panel');
  const form = root.querySelector('[data-ai-form]');
  const input = root.querySelector('[data-ai-input]');
  const messages = root.querySelector('[data-ai-messages]');
  const searchButton = root.querySelector('[data-ai-search]');
  let webSearch = false;
  let history = [];

  const copy = {
    en: { eyebrow: 'Twoday Studio', title: 'Studio AI', welcome: 'Ask about our games, studio, or publishing.', inputLabel: 'Message', placeholder: 'Ask Twoday Studio AI...', search: 'Web search', send: 'Send', thinking: 'Thinking…', error: 'The AI is unavailable right now. Please try again.' },
    tr: { eyebrow: 'Twoday Studio', title: 'Studio AI', welcome: 'Oyunlarımızı, stüdyomuzu veya yayıncılığı sorabilirsiniz.', inputLabel: 'Mesaj', placeholder: 'Twoday Studio AI’a sorun...', search: 'Web araması', send: 'Gönder', thinking: 'Düşünüyor…', error: 'AI şu anda kullanılamıyor. Lütfen tekrar deneyin.' },
    ar: { eyebrow: 'Twoday Studio', title: 'استوديو AI', welcome: 'اسأل عن ألعابنا أو الاستوديو أو النشر.', inputLabel: 'الرسالة', placeholder: 'اسأل Twoday Studio AI...', search: 'بحث على الويب', send: 'إرسال', thinking: 'يفكر…', error: 'الذكاء الاصطناعي غير متاح الآن. حاول مرة أخرى.' },
    zh: { eyebrow: 'Twoday Studio', title: '工作室 AI', welcome: '可以询问我们的游戏、工作室或发行合作。', inputLabel: '消息', placeholder: '向 Twoday Studio AI 提问…', search: '网页搜索', send: '发送', thinking: '思考中…', error: 'AI 暂时不可用，请稍后再试。' }
  };

  function language() { return localStorage.getItem('twoday-lang') || document.documentElement.lang || 'en'; }
  function setCopy() {
    const t = copy[language()] || copy.en;
    root.querySelectorAll('[data-ai-label]').forEach((el) => { const key = el.dataset.aiLabel; if (t[key]) el.textContent = t[key]; });
    root.querySelector('[data-ai-welcome]').textContent = t.welcome;
    input.placeholder = t.placeholder;
    input.setAttribute('aria-label', t.inputLabel);
  }
  function toggle(open) { panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); if (open) input.focus(); }
  function addMessage(text, role) { const item = document.createElement('p'); item.className = `consumer-ai-message is-${role}`; item.textContent = text; messages.appendChild(item); messages.scrollTop = messages.scrollHeight; return item; }
  function setBusy(busy) { form.querySelector('[type="submit"]').disabled = busy; input.disabled = busy; }

  launcher.addEventListener('click', () => toggle(panel.hidden));
  root.querySelector('.consumer-ai-close').addEventListener('click', () => toggle(false));
  searchButton.addEventListener('click', () => { webSearch = !webSearch; searchButton.setAttribute('aria-pressed', String(webSearch)); searchButton.classList.toggle('is-active', webSearch); });
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
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history, language: language(), webSearch }) });
      const data = await response.json();
      if (!response.ok || !data.answer) throw new Error(data.error || 'AI request failed');
      thinking.textContent = data.answer;
      history = [...history, { role: 'user', content: text }, { role: 'assistant', content: data.answer }].slice(-12);
    } catch (error) { thinking.textContent = t.error; console.error(error); }
    finally { setBusy(false); input.focus(); }
  });
  setCopy();
})();
