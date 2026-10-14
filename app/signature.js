/* Touch Events fallback for older iPad Safari; no external libraries. */
(function (global) {
  global.createSignaturePad = function (canvas) {
    canvas.width = 900;
    canvas.height = 360;
    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#152e28';
    var active = null;
    var pad = { canvas: canvas, drawn: false, clear: function () {
      active = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pad.drawn = false;
    }};
    function point(e) {
      var rect = canvas.getBoundingClientRect();
      return [(e.clientX - rect.left) * canvas.width / rect.width,
        (e.clientY - rect.top) * canvas.height / rect.height];
    }
    function start(e, id) {
      if (active !== null) return;
      active = id;
      var p = point(e);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
    }
    function move(e, id) {
      if (active !== id) return;
      var p = point(e);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      pad.drawn = true;
    }
    function stop(id) { if (active === id) active = null; }
    if (global.PointerEvent) {
      canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        start(e, e.pointerId);
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', function (e) { move(e, e.pointerId); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (name) {
        canvas.addEventListener(name, function (e) { stop(e.pointerId); });
      });
    } else {
      function touchHandler(e) {
        e.preventDefault(); // Prevent scrolling only inside the signature canvas.
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (e.type === 'touchstart') start(t, t.identifier);
          else if (e.type === 'touchmove') move(t, t.identifier);
          else stop(t.identifier);
        }
      }
      ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (name) {
        canvas.addEventListener(name, touchHandler, { passive: false });
      });
      canvas.addEventListener('mousedown', function (e) { if (e.button === 0) start(e, 'mouse'); });
      canvas.addEventListener('mousemove', function (e) { move(e, 'mouse'); });
      canvas.addEventListener('mouseup', function () { stop('mouse'); });
      canvas.addEventListener('mouseleave', function () { stop('mouse'); });
    }
    canvas.signaturePad=pad; global.lenovoSignaturePad=pad; return pad;
  };
})(window);
