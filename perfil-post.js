 
(function () {
  'use strict';

  var DB = 'https://unsheltered-72d40-default-rtdb.firebaseio.com';

 
  var ORDEM = ['forca', 'resistencia', 'agilidade', 'destreza', 'sabedoria', 'carisma', 'inteligencia', 'determinacao'];

  var cache = {};

  function buscar(no, uid) {
    var caminho = no + '/' + uid;
    if (!cache[caminho]) {
      cache[caminho] = fetch(DB + '/' + caminho + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .catch(function (erro) {
          console.error('[Unsheltered] Falha ao ler ' + caminho + ':', erro);
          return null;
        });
    }
    return cache[caminho];
  }

  function preencherAtributos(container, dados) {
    if (!dados) return;
    container.querySelectorAll('strong').forEach(function (strong, i) {
      var campo = ORDEM[i];
      if (!campo || dados[campo] === undefined || dados[campo] === null) return;
      strong.textContent = String(dados[campo]).padStart(2, '0');
    });
  }

  function preencherMoeda(el, dados) {
    if (!dados) return;
    var valor = Number(dados.saldo);
    if (!Number.isFinite(valor)) return;
    var icone = el.querySelector('i');
    el.textContent = ' ' + valor.toLocaleString('pt-BR');
    if (icone) el.prepend(icone);
  }

  function iniciar() {
    document.querySelectorAll('.postuser').forEach(function (postuser) {
      var link = postuser.querySelector('.name-post a');
      var m = link && (link.getAttribute('href') || '').match(/\/u(\d+)/);
      if (!m) return;
      var uid = 'u' + m[1];

      var atributos = postuser.querySelector('.tp-atributos .ppfcontent');
      if (atributos) {
        buscar('atributos', uid).then(function (d) { preencherAtributos(atributos, d); });
      }

      var lit = postuser.querySelector('.span2 lit');
      if (!lit) return;

      var galeoes = lit.querySelector('span3');
      var nuques = lit.querySelector('span4');
      if (galeoes) buscar('saldos', uid).then(function (d) { preencherMoeda(galeoes, d); });
      if (nuques) buscar('nuques', uid).then(function (d) { preencherMoeda(nuques, d); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();