
(function () {
  'use strict';

 
  if (typeof _userdata === 'undefined') return;
  if (!_userdata.session_logged_in || _userdata.user_id < 1) return;

  var DB = 'https://unsheltered-72d40-default-rtdb.firebaseio.com';
  var uid = 'u' + _userdata.user_id;
  var nome = _userdata.username;

  
  var chave = 'unsh-init:' + uid + ':' + nome;
  try { if (sessionStorage.getItem(chave)) return; } catch (e) {}

  var CONTAS = [
    { no: 'saldos', inicial: 4000 },
    { no: 'nuques', inicial: 0 }
  ];

  function req(caminho, metodo, corpo) {
    var opcoes = { method: metodo || 'GET' };
    if (corpo) {
      opcoes.headers = { 'Content-Type': 'application/json' };
      opcoes.body = JSON.stringify(corpo);
    }
    return fetch(DB + '/' + caminho + '.json', opcoes).then(function (r) {
      if (!r.ok) throw new Error(opcoes.method + ' ' + caminho + ' → HTTP ' + r.status);
      return r.json();
    });
  }

  function garantir(conta) {
    var caminho = conta.no + '/' + uid;
    return req(caminho).then(function (atual) {
      if (!atual) return req(caminho, 'PUT', { saldo: conta.inicial, nome: nome });
      if (atual.nome !== nome) return req(caminho, 'PATCH', { nome: nome });
    });
  }

  Promise.all(CONTAS.map(garantir))
    .then(function () {
      try { sessionStorage.setItem(chave, '1'); } catch (e) {}
    })
    .catch(function (erro) {
      console.error('[Unsheltered] Falha ao inicializar personagem:', erro);
    });
})();
