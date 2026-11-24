  $(function () {
    /* =========================
       Multi-step + Parsley
    ========================== */
    var $multi    = $('[multi-step]');
    var $sections = $multi.find('[form-step]');
    var $content  = $('.form_content');
    var $panes    = $content.find('.form_content-pane');

    function showLeftPane(index) {
      var $match = $content.find('.form_content-pane[data-step="' + index + '"]');
      var $pane  = $match.length ? $match.first() : $panes.eq(index);
      $panes.removeClass('is-visible').attr('hidden', true);
      if ($pane && $pane.length) $pane.addClass('is-visible').removeAttr('hidden');
    }

    function navigateTo(index) {
      $sections.removeClass('is-active').eq(index).addClass('is-active');
      $('[form-button="back"]').toggle(index > 0);
      var atTheEnd = index >= $sections.length - 1;
      $('[form-button="next"]').toggle(!atTheEnd);
      $('[form-button="submit"]').toggle(atTheEnd);
      showLeftPane(index);
    }

    function curIndex() { return $sections.index($sections.filter('.is-active')); }

    $('[form-button="back"]').on('click', function () {
      navigateTo(curIndex() - 1);
    });

    $('[form-button="next"]').on('click', function () {
      $multi.parsley().whenValidate({ group: 'block-' + curIndex() })
        .done(function () { navigateTo(curIndex() + 1); });
    });

    // Parsley groups
    $sections.each(function (i, section) {
      $(section).find(':input').attr('data-parsley-group', 'block-' + i);
    });

    // Start op stap 0
    navigateTo(0);

      /* =========================
       Radio UI selected state
    ========================== */
    function getWrapForInput(input) {
      var $w = $(input).closest('.radio_wrap');
      if (!$w.length && input.id) $w = $('label[for="' + input.id + '"]').closest('.radio_wrap');
      return $w;
    }

    function updateSelectedStates() {
      $('input[type="radio"]').each(function () {
        var $w = getWrapForInput(this);
        if ($w.length) $w.find('.radio_circle').toggleClass('selected', this.checked);
      });
    }

    $('.radio_wrap').on('click', function () {
      var $radio = $(this).find('input[type="radio"]');
      if (!$radio.length) {
        var forId = $(this).attr('for') || $(this).find('label[for]').attr('for');
        if (forId) $radio = $('#' + forId);
      }
      if ($radio.length && !$radio.prop('checked')) $radio.prop('checked', true).trigger('change');
      setTimeout(updateSelectedStates, 0);
    });

    $(document).on('change', 'input[type="radio"]', updateSelectedStates);

    updateSelectedStates();

    /* =========================
       Aansluitadres toggle
    ========================== */
    (function () {
      var fieldIds = [
        'straataansluitadres',
        'huisnummeraansluitadres',
        'postcodeaansluitadres',
        'plaatsaansluitadres'
      ];

      function getWrapper($el) {
        var $w = $el.closest('.form_field-wrapper');
        return $w.length ? $w : $el;
      }

      function hideField($el, hide) {
        var $wrap = getWrapper($el);
        if (hide) $wrap.attr('hidden', true);
        else $wrap.removeAttr('hidden');
      }

      function toggleAansluitadres() {
        var same = $('#is-aansluitadres').is(':checked');
        fieldIds.forEach(function (id) {
          var $f = $('#' + id);
          if (!$f.length) return;
          if (same) {
            hideField($f, true);
            $f.attr('data-parsley-excluded', 'true').prop('required', false);
            if ($f.parsley && $f.parsley().reset) { try { $f.parsley().reset(); } catch (e) {} }
          } else {
            hideField($f, false);
            $f.removeAttr('data-parsley-excluded').prop('required', true);
          }
        });
      }

      $('#is-aansluitadres').on('change', toggleAansluitadres);
      toggleAansluitadres();
    })();

    /* =========================
       Extra opties toggle (televisie ja/nee)
    ========================== */
    (function () {
      var $extra = $('#extra-options');
      if (!$extra.length) return;

      function setExtra(show) {
        if (show) {
          $extra.stop(true, true).slideDown(150)
            .attr('aria-hidden', 'false').removeAttr('hidden');
          $extra.find(':input').prop('disabled', false).removeAttr('data-parsley-excluded');
        } else {
          $extra.stop(true, true).slideUp(150)
            .attr('aria-hidden', 'true').attr('hidden', true);
          $extra.find(':input').each(function () {
            var $el = $(this);
            if ($el.is(':checkbox,:radio')) $el.prop('checked', false);
            else $el.val('');
            $el.prop('disabled', true).attr('data-parsley-excluded', 'true');
            try { var p = $el.parsley && $el.parsley(); if (p && p.reset) p.reset(); } catch (e) {}
          });
        }
      }

      function computeFromRadios() {
        var yesChecked = $('#televisie-ja').is(':checked');
        if (!yesChecked && !$('input#televisie-ja').length) {
          var $grp = $('input[type="radio"][name="televisie"]');
          if ($grp.length) {
            var val = ($grp.filter(':checked').val() || '').toLowerCase();
            yesChecked = (val === 'ja' || val === 'yes' || val === 'true' || val === 'televisie - ja');
          }
        }
        setExtra(yesChecked);
      }

      $(document).on('change', '#televisie-ja, #televisie-nee', computeFromRadios);
      $(document).on('change', 'input[type="radio"][name="televisie"]', computeFromRadios);

      computeFromRadios();

      var observer = new MutationObserver(function (mutations) {
        var needsCompute = mutations.some(function (m) {
          return m.type === 'attributes'
            && m.attributeName === 'class'
            && m.target
            && (m.target.hasAttribute('form-step') || m.target.matches('[form-step]'));
        });
        if (needsCompute) computeFromRadios();
      });
      observer.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
    })();

     /* =========================
       Particulier / Bedrijf toggle (bedrijfsnaam in volgende stap)
    ========================== */
    (function () {
      var $input = $('#bedrijfsnaam');
      if (!$input.is('input')) $input = $input.find('input').first(); // ID op wrapper i.p.v. input
      if (!$input.length) return;
      var $wrap = $('#bedrijfsnaam-wrap');
      if (!$wrap.length) $wrap = $input.closest('.form_field-wrapper');

      function isBedrijf() {
        // 1) via ID (werkt ook als het ID op het label/wrapper staat)
        var $r = $('#klanttype-bedrijf');
        if ($r.length && !$r.is('input')) $r = $r.find('input[type="radio"]');
        if ($r.is(':checked')) return true;
        // 2) fallback: aangevinkte radio met waarde "Bedrijf"
        return $('input[type="radio"]:checked').filter(function () {
          return (this.value || '').trim().toLowerCase() === 'bedrijf';
        }).length > 0;
      }

      function toggleBedrijf() {
        if (isBedrijf()) {
          $wrap.css('display', '');
          if ($wrap.css('display') === 'none') $wrap.css('display', 'block');
          $input
            .prop('disabled', false)
            .prop('required', true)
            .attr('data-parsley-required', 'true')
            .removeAttr('data-parsley-excluded');
        } else {
          $wrap.css('display', 'none');
          $input
            .val('')
            .prop('required', false)
            .prop('disabled', true)
            .attr('data-parsley-required', 'false')
            .attr('data-parsley-excluded', 'true');
          try { var p = $input.parsley && $input.parsley(); if (p && p.reset) p.reset(); } catch (e) {}
        }

        syncSummaryNow();
      }

      // Reageer op elke radio-wijziging, ongeacht de group name
      $(document).on('change', 'input[type="radio"]', toggleBedrijf);
      $(document).on('click', '.radio_wrap', function () { setTimeout(toggleBedrijf, 0); });
      toggleBedrijf(); // start: verborgen tot er "Bedrijf" gekozen wordt
    })();

        /* =========================
       Telefonie: bestaand nummer (best-nummer ja/nee)
    ========================== */
    (function () {
		var wrapIds = [
  			'best-nummer-behouden'
		];
      var VERPLICHT = false; // zet op true als de velden verplicht moeten zijn bij "Ja"

      var $wraps = $(wrapIds.map(function (id) { return '#' + id; }).join(', '));
      if (!$wraps.length) return;

      function isJa() {
        return $('input[type="radio"]:checked').filter(function () {
          return (this.name || '').toLowerCase() === 'best-nummer'
              && (this.value || '').trim().toLowerCase().indexOf('ja') === 0;
        }).length > 0;
      }

      function getInputs($w) {
        return $w.is(':input') ? $w : $w.find(':input');
      }

      function toggleBestNummer() {
        var show = isJa();

        $wraps.each(function () {
          var $w = $(this);
          var $inputs = getInputs($w);

          if (show) {
            $w.css('display', '');
            if ($w.css('display') === 'none') $w.css('display', 'block');
            $inputs.prop('disabled', false).removeAttr('data-parsley-excluded');
            if (VERPLICHT) $inputs.prop('required', true).attr('data-parsley-required', 'true');
          } else {
            $w.css('display', 'none');
            $inputs.each(function () {
              var $el = $(this);
              if ($el.is(':checkbox,:radio')) $el.prop('checked', false);
              else $el.val('');
              $el.prop('required', false)
                 .prop('disabled', true)
                 .attr('data-parsley-required', 'false')
                 .attr('data-parsley-excluded', 'true');
              try { var p = $el.parsley && $el.parsley(); if (p && p.reset) p.reset(); } catch (e) {}
            });
          }
        });

        syncSummaryNow();
      }

      $(document).on('change', 'input[type="radio"]', toggleBestNummer);
      $(document).on('click', '.radio_wrap', function () { setTimeout(toggleBestNummer, 0); });
      toggleBestNummer(); // start: verborgen tot er "Ja" gekozen wordt
    })();

    /* =========================
       Prijzen incl./excl. btw (Particulier / Bedrijf)
    ========================== */
    (function () {
      var BTW = 0.21;

      function parsePrice(v) {
        if (v == null || String(v).trim() === '') return null;
        var n = parseFloat(String(v).replace(/[€\s]/g, '').replace(',', '.'));
        return isNaN(n) ? null : n;
      }

      function formatPrice(n) {
        return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });
      }

      function updatePrices() {
        var zakelijk = $('#klanttype-bedrijf').is(':checked');

        $('[data-price-incl], [data-price-excl]').each(function () {
          var $el  = $(this);
          var incl = parsePrice($el.attr('data-price-incl'));
          var excl = parsePrice($el.attr('data-price-excl'));

          // Eén van beide ingevuld? Reken de andere uit.
          if (incl == null && excl != null) incl = excl * (1 + BTW);
          if (excl == null && incl != null) excl = incl / (1 + BTW);

          var prijs = zakelijk ? excl : incl;
                    if (prijs != null) $el.text(formatPrice(prijs) + (zakelijk ? ' excl. btw' : ' incl. btw'));
        });

        $('[data-btw-label]').text(zakelijk ? 'excl. btw' : 'incl. btw');
      }

      $(document).on('change', 'input[type="radio"][name="klanttype"]', updatePrices);
      updatePrices(); // standaard: incl. btw (particulier)
    })();
    
    /* =========================
       Samenvatting (vullen + verbergen per wrapper/rij)
    ========================== */

    // Schrijft tekst naar [field="key"] én markeert inhoud met data-has-value="1|0"
    function setFieldValue(key, text) {
      var $targets = $('[field="' + key + '"]');
      var clean = (text || '').replace(/[\u00A0\u200B]/g, ' ').trim();
      var has = clean.length > 0;
      $targets.text(clean).attr('data-has-value', has ? '1' : '0');
    }

    // Verberg per .form_field-wrapper; verberg hele row als alle wrappers leeg zijn
    function toggleEmptySummary() {
      $('.form_field-row').each(function () {
        var $row = $(this);
        var $wrappers = $row.find('.form_field-wrapper');

        var affected = 0; // wrappers met [field]
        var visible  = 0; // wrappers met waarde

        $wrappers.each(function () {
          var $wrap = $(this);
          var $fields = $wrap.find('.form_input [field]');
          if (!$fields.length) return; // wrapper zonder summary fields

          affected++;
          // Heeft deze wrapper minimaal één field met data-has-value="1"?
          var hasValue = $fields.filter('[data-has-value="1"]').length > 0;

          $wrap.attr('hidden', !hasValue);
          if (hasValue) visible++;
        });

        // Hele rij verbergen als alle relevante wrappers leeg zijn
        if (affected > 0) $row.attr('hidden', visible === 0);
      });
    }

    // Hoofdfunctie: vult de samenvatting
    function syncSummaryNow() {
      // Tekstinputs (geen radio/checkbox)
      $('input[data-name]:not([type=radio]):not([type=checkbox])').each(function () {
        var key = $(this).data('name');
        setFieldValue(key, $(this).val() || '');
      });

      // Radio's
      var radioGroups = new Set();
      $('input[type="radio"][data-name]').each(function () {
        var key = $(this).data('name');
        if (radioGroups.has(key)) return;
        radioGroups.add(key);
        var val = $('input[type="radio"][data-name="' + key + '"]:checked').val() || '';
        setFieldValue(key, val);
      });

      // Checkboxes (gebruik ALTÍJD labeltekst, nooit value "on")
      var checkboxGroups = new Set();
      $('input[type="checkbox"][data-name]').each(function () {
        var key = $(this).data('name');
        if (checkboxGroups.has(key)) return;
        checkboxGroups.add(key);

        var values = $('input[type="checkbox"][data-name="' + key + '"]:checked')
          .map(function () {
            var $cb = $(this);
            var id  = $cb.attr('id');

            // 1) label via for=id
            var labelText = id ? $('label[for="' + id + '"]').first().text().trim() : '';

            // 2) Webflow sibling label
            if (!labelText) labelText = $cb.siblings('label.w-form-label').text().trim();

            // 3) label binnen dezelfde .w-checkbox wrapper
            if (!labelText) labelText = $cb.closest('.w-checkbox').find('label').first().text().trim();

            // 4) input genest in label
            if (!labelText) labelText = $cb.closest('label').text().trim();

            // 5) algemene tekst-span binnen wrapper
            if (!labelText) labelText = $cb.closest('.w-checkbox')
              .find('.checkbox-label, .w-checkbox-label, .label-text, .w-form-label')
              .first().text().trim();

            // 6) laatste redmiddel: custom attribuut of title
            if (!labelText) labelText = ($cb.attr('data-label') || $cb.attr('title') || '').trim();

            return labelText;
          })
          .get()
          .filter(function (t) { return t && t.length; });

        setFieldValue(key, values.join(', '));
      });

      // Toon/verberg wrappers & rijen op basis van data-has-value
      toggleEmptySummary();
    }

    // Init + live updates
    syncSummaryNow();
    $(document).on('change keyup', 'input[data-name]', function () {
      syncSummaryNow();
      updateSelectedStates();
    });
  });
