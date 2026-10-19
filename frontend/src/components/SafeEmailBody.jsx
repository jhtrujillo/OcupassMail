import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ImageOff } from 'lucide-react';

/**
 * Muestra el HTML de un correo de forma segura:
 *  1. Se limpia con DOMPurify (elimina scripts, eventos onX, formularios, iframes...).
 *  2. Se pinta dentro de un <iframe sandbox> SIN permiso de ejecutar scripts,
 *     así los estilos del correo tampoco afectan la app.
 *  3. Las imágenes remotas (píxeles de rastreo) se bloquean hasta que el usuario las permita.
 */

const REMOTE_RE = /^(https?:)?\/\//i;

function sanitizeEmail(html, allowRemote) {
  let blocked = 0;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    if (!allowRemote) {
      if (node.tagName === 'IMG' && REMOTE_RE.test(node.getAttribute('src') || '')) {
        node.removeAttribute('src');
        node.setAttribute('alt', node.getAttribute('alt') || '[imagen bloqueada]');
        blocked++;
      }
      if (node.hasAttribute && node.hasAttribute('srcset')) {
        node.removeAttribute('srcset');
      }
      if (node.hasAttribute && node.hasAttribute('background')) {
        node.removeAttribute('background');
        blocked++;
      }
      const style = node.getAttribute && node.getAttribute('style');
      if (style && /url\(/i.test(style)) {
        node.setAttribute('style', style.replace(/url\([^)]*\)/gi, 'none'));
        blocked++;
      }
    }
  });

  let clean = DOMPurify.sanitize(html || '', {
    WHOLE_DOCUMENT: true,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'link', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'script', 'noscript'],
    FORBID_ATTR: ['action', 'formaction', 'ping'],
  });
  DOMPurify.removeHook('afterSanitizeAttributes');

  if (!allowRemote) {
    // url(...) remotos dentro de bloques <style>
    clean = clean.replace(/url\(\s*(['"]?)(https?:)?\/\/[^)]*\)/gi, () => {
      blocked++;
      return 'none';
    });
    clean = clean.replace(/@import[^;]+;/gi, '');
  }

  return { clean, blocked };
}

export default function SafeEmailBody({ html, className = '' }) {
  const iframeRef = useRef(null);
  const [allowRemote, setAllowRemote] = useState(false);
  const [height, setHeight] = useState(80);

  const { clean, blocked } = useMemo(() => sanitizeEmail(html, allowRemote), [html, allowRemote]);

  const [textColor, setTextColor] = useState('inherit');
  useEffect(() => {
    const parent = iframeRef.current?.parentElement;
    if (parent) setTextColor(getComputedStyle(parent).color);
  }, [html]);

  const srcDoc = useMemo(() => {
    const baseStyle = `<style>
      html,body{margin:0;padding:0;background:transparent;color:${textColor};
        font-family:Roboto,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.6;
        word-wrap:break-word;overflow-wrap:anywhere;}
      img{max-width:100%;height:auto;}
      table{max-width:100%;}
      a{color:#1a73e8;}
      pre{white-space:pre-wrap;}
    </style>`;
    if (/<head[^>]*>/i.test(clean)) {
      return clean.replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8">${baseStyle}`);
    }
    return `<!doctype html><html><head><meta charset="utf-8">${baseStyle}</head><body>${clean}</body></html>`;
  }, [clean, textColor]);

  const resize = () => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.documentElement) {
      setHeight(Math.max(40, doc.documentElement.scrollHeight + 4));
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;
    let ro;
    const onLoad = () => {
      resize();
      const doc = iframe.contentDocument;
      if (doc?.body && 'ResizeObserver' in window) {
        ro = new ResizeObserver(resize);
        ro.observe(doc.body);
      }
      // Las imágenes cargan después del onload del documento
      doc?.querySelectorAll('img').forEach((img) => img.addEventListener('load', resize));
    };
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
    };
  }, [srcDoc]);

  return (
    <div className={className}>
      {blocked > 0 && !allowRemote && (
        <div className="not-prose mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <ImageOff className="h-3.5 w-3.5" /> Imágenes externas bloqueadas para proteger tu privacidad.
          </span>
          <button
            type="button"
            onClick={() => setAllowRemote(true)}
            className="font-semibold underline hover:no-underline"
          >
            Mostrar imágenes
          </button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Contenido del correo"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
        style={{ width: '100%', height, border: 0, display: 'block', background: 'transparent' }}
      />
    </div>
  );
}
