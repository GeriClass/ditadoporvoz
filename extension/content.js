// Content script: mantém o último campo editável focado e insere o texto
// ditado nele quando o popup solicita.

let lastEditable = null;

function isEditable(node) {
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || node.isContentEditable;
}

document.addEventListener(
  'focusin',
  (event) => {
    if (isEditable(event.target)) lastEditable = event.target;
  },
  true
);

function insertText(target, text) {
  if (!target) return false;

  if (target.isContentEditable) {
    target.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      target.textContent += text;
    }
    target.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return true;
  }

  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    target.focus();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.value = target.value.slice(0, start) + text + target.value.slice(end);
    const caret = start + text.length;
    target.setSelectionRange(caret, caret);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'ditado-insert') return;
  const target = isEditable(document.activeElement) ? document.activeElement : lastEditable;
  const ok = insertText(target, message.text);
  sendResponse({ ok });
  return true;
});
