const SCRIPT_ID = 'enable-a11y-script';
const SCRIPT_SRC = 'https://cdn.enable.co.il/licenses/enable-L54833ny8zb0nwdm-0426-84189/init.js';

export function mountEnableAccessibility() {
  document.documentElement.removeAttribute('data-hide-enable-a11y');

  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.async = true;
  document.body.appendChild(script);
}

export function hideEnableAccessibility() {
  document.documentElement.setAttribute('data-hide-enable-a11y', '');
}
