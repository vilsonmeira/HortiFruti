/* Impressão de comprovantes térmicos — HortiFruti PDV
   Papel contínuo: 50 mm; área útil: 48 mm; retrato; margens zeradas.
   Altura automática conforme o conteúdo. */
(function () {
  'use strict';
  window.printarCupom = function (texto) {
    const janela = window.open('', '_blank', 'width=420,height=700');
    if (!janela) {
      alert('Permita pop-ups para imprimir o comprovante.');
      return false;
    }
    const documento = janela.document;
    janela.addEventListener('load', function () {
      janela.focus();
      janela.print();
    }, { once: true });
    documento.open();
    documento.write('<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Comprovante HortiFruti</title>' +
      '<style>' +
      '@page{size:50mm auto;margin:0}' +
      'html,body{width:50mm;margin:0;padding:0;background:#fff;color:#000}' +
      'body{font-family:Arial,sans-serif}' +
      'pre{box-sizing:border-box;width:48mm;margin:0;padding:0;border:0;' +
      'font-family:"Courier New",monospace;font-size:9px;line-height:1.28;' +
      'font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}' +
      '@media screen{body{padding:4mm 1mm}pre{width:48mm}}' +
      '</style></head><body><pre></pre></body></html>');
    documento.close();
    documento.querySelector('pre').textContent = String(texto || '').trim();
    janela.focus();
    return true;
  };
})();