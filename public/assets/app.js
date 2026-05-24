/* Dragnet client-side interactions */
(function () {
    'use strict';

    /* ── Rule accordion lazy-loader ─────────────────────────────────────── */

    function getLang(filename) {
        if (filename.endsWith('.yaml') || filename.endsWith('.yaral')) return 'yaml';
        if (filename.endsWith('.json')) return 'json';
        if (filename.endsWith('.xml')) return 'xml';
        if (filename.endsWith('.rules')) return 'nginx';
        return 'sql';
    }

    function makeCodeBlock(label, text, url, isCSIOC) {
        var wrapper = document.createElement('div');
        wrapper.className = 'code-block';

        var header = document.createElement('div');
        header.className = 'code-header';

        var labelEl = document.createElement('span');
        labelEl.className = 'rule-label';
        labelEl.textContent = label;

        var actions = document.createElement('div');
        actions.className = 'code-actions';

        var rawLink = document.createElement('a');
        rawLink.href = url;
        rawLink.target = '_blank';
        rawLink.rel = 'noopener';
        rawLink.className = 'raw-link';
        rawLink.textContent = 'Raw ↗';

        var copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', function () {
            var codeEl = wrapper.querySelector('code');
            if (codeEl) navigator.clipboard.writeText(codeEl.textContent || '');
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(function () {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        });

        actions.appendChild(rawLink);
        actions.appendChild(copyBtn);
        header.appendChild(labelEl);
        header.appendChild(actions);

        var pre = document.createElement('pre');
        var code = document.createElement('code');
        code.className = 'language-' + getLang(url);
        code.textContent = text;
        pre.appendChild(code);

        wrapper.appendChild(header);
        wrapper.appendChild(pre);

        if (isCSIOC) {
            var note = document.createElement('div');
            note.className = 'cs-upload-note';

            var p = document.createElement('p');
            p.textContent = 'Upload to Falcon via API:';

            var uploadPre = document.createElement('pre');
            var uploadCode = document.createElement('code');
            uploadCode.className = 'language-bash';
            uploadCode.textContent =
                'curl -X POST https://api.crowdstrike.com/indicators/entities/iocs/v1 \\\n' +
                '  -H "Authorization: Bearer <token>" \\\n' +
                '  --data-binary @dragnet-ioc.json';
            uploadPre.appendChild(uploadCode);

            note.appendChild(p);
            note.appendChild(uploadPre);
            wrapper.appendChild(note);
        }

        return wrapper;
    }

    document.querySelectorAll('details.rule-platform').forEach(function (el) {
        el.addEventListener('toggle', async function () {
            if (!el.open) return;
            var content = el.querySelector('.rule-content');
            if (!content || content.dataset.loaded === 'true') return;

            var platform = el.dataset.platform;
            var filesRaw = el.dataset.files;
            if (!platform || !filesRaw) return;

            var files;
            try { files = JSON.parse(filesRaw); } catch (e) { return; }
            var isCSIOC = platform === 'crowdstrike_ioc';

            var skeleton = content.querySelector('.rule-skeleton');
            if (skeleton) {
                skeleton.textContent = 'Loading…';
                skeleton.className = 'rule-loading';
            }

            var results = await Promise.all(files.map(async function (f) {
                var url = f.url;
                try {
                    var res = await fetch(url);
                    var text = res.ok ? await res.text() : '// Rule not available';
                    return { label: f.label, file: f.file, text: text, url: url };
                } catch (_) {
                    return { label: f.label, file: f.file, text: '// Rule not available', url: url };
                }
            }));

            var sentinelNote = content.querySelector('[data-sentinel-note]');
            while (content.firstChild) content.removeChild(content.firstChild);
            if (sentinelNote) content.appendChild(sentinelNote);

            results.forEach(function (b) {
                var block = makeCodeBlock(b.label, b.text, b.url, isCSIOC);
                content.appendChild(block);
                var codeEl = block.querySelector('code');
                if (codeEl && window.hljs) hljs.highlightElement(codeEl);
                if (isCSIOC) {
                    var uploadCode = block.querySelector('.cs-upload-note code');
                    if (uploadCode && window.hljs) hljs.highlightElement(uploadCode);
                }
            });

            content.dataset.loaded = 'true';
        });
    });

    /* ── Generic copy buttons (data-copy attribute) ──────────────────────── */

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.copy-btn[data-copy]') : null;
        if (!btn) return;
        navigator.clipboard.writeText(btn.dataset.copy || '');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
        }, 2000);
    });

    /* ── Platform link → open accordion ─────────────────────────────────── */

    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('[data-open-platform]') : null;
        if (!link) return;
        e.preventDefault();
        var platformId = link.dataset.openPlatform;
        var detail = document.querySelector('details[data-platform="' + platformId + '"]');
        if (detail) {
            detail.open = true;
            detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    /* ── Incident detail tabs ────────────────────────────────────────────── */

    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
            btn.classList.add('active');
            var panel = document.getElementById('tab-' + tabId);
            if (panel) panel.classList.add('active');
        });
    });

    /* ── Packages show-more ──────────────────────────────────────────────── */

    var showMoreBtn = document.querySelector('.show-more-btn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', function () {
            document.querySelectorAll('.pkg-row-hidden').forEach(function (row) {
                row.style.display = '';
            });
            showMoreBtn.style.display = 'none';
        });
    }

    /* ── Check widget: placeholder cycling + smart endpoint routing ─────── */

    var checkInput = document.getElementById('check-input');
    var checkForm  = document.getElementById('check-form');
    var checkResult = document.getElementById('check-result');

    if (checkInput && checkInput.dataset.placeholders) {
        var placeholders;
        try { placeholders = JSON.parse(checkInput.dataset.placeholders); } catch (_) { placeholders = []; }
        if (placeholders.length > 1) {
            var phIdx = 0;
            setInterval(function () {
                phIdx = (phIdx + 1) % placeholders.length;
                checkInput.placeholder = 'e.g. ' + placeholders[phIdx];
            }, 3000);
        }
    }

    function isImageRef(value) {
        if (!value.includes(':')) return false;
        if (/^[\w\.\-]+:\/\//.test(value)) return false;
        return /^[a-z0-9\-\._\/]+:[a-z0-9\.\-\_]+$/i.test(value);
    }

    if (checkForm && checkResult) {
        checkForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var value = (checkInput ? checkInput.value : '').trim();
            if (!value) return;
            var endpoint = isImageRef(value) ? '/check-image' : '/check';
            checkInput && checkInput.classList.add('loading');
            checkResult.textContent = '';
            var tsToken = window._tsToken || '';
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: value, 'cf-turnstile-response': tsToken }),
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    checkInput && checkInput.classList.remove('loading');
                    window._tsToken = '';
                    window.turnstile && window.turnstile.reset && window.turnstile.reset();
                    if (data.error) {
                        checkResult.textContent = data.error;
                        checkResult.className = 'check-result';
                        return;
                    }
                    if (!data.compromised) {
                        checkResult.className = 'check-result check-clean';
                        checkResult.textContent = '✓ Not found in any Dragnet incident';
                        return;
                    }
                    checkResult.className = 'check-result';
                    var hit = data.hits[0];
                    var a = document.createElement('a');
                    a.href = hit.url;
                    a.textContent = hit.incident + (hit.campaign ? ' · ' + hit.campaign : '') + (hit.image ? ' · ' + hit.image : '');
                    var span = document.createElement('span');
                    span.className = 'check-hit';
                    span.textContent = '🔴 COMPROMISED ';
                    checkResult.appendChild(span);
                    checkResult.appendChild(a);
                    if (data.hits.length > 1) {
                        var more = document.createElement('span');
                        more.style.color = 'var(--text-muted)';
                        more.style.fontSize = '12px';
                        more.textContent = ' (+' + (data.hits.length - 1) + ' more)';
                        checkResult.appendChild(more);
                    }
                })
                .catch(function () {
                    checkInput && checkInput.classList.remove('loading');
                    checkResult.className = 'check-result';
                    checkResult.textContent = 'Check failed. Please try again.';
                });
        });
    }

    /* ── Homepage typeahead ──────────────────────────────────────────────── */

    var searchInput = document.getElementById('search-input');
    var searchDropdown = document.getElementById('search-dropdown');
    if (!searchInput || !searchDropdown) return;

    var incidentIndex = [];
    var activeIdx = -1;

    fetch('/api/index')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            if (data && data.incidents) incidentIndex = data.incidents;
        })
        .catch(function () {});

    function escText(s) {
        var d = document.createElement('span');
        d.textContent = s;
        return d.textContent;
    }

    function severityColor(sev) {
        var map = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' };
        return map[sev] || 'var(--text-muted)';
    }

    function buildDropdown(results, query) {
        while (searchDropdown.firstChild) searchDropdown.removeChild(searchDropdown.firstChild);

        if (!results.length) {
            searchDropdown.classList.remove('open');
            return;
        }

        var groups = { package: [], campaign: [], actor: [], ioc: [] };
        results.forEach(function (r) {
            if (groups[r.type]) groups[r.type].push(r);
        });

        var groupLabels = { package: 'PACKAGES', campaign: 'CAMPAIGNS', actor: 'ACTORS', ioc: 'IOCS' };
        var groupIcons  = { package: '📦', campaign: '🎯', actor: '👤', ioc: '🌐' };

        var items = [];
        Object.keys(groups).forEach(function (type) {
            var group = groups[type];
            if (!group.length) return;

            var gl = document.createElement('div');
            gl.className = 'search-group-label';
            gl.textContent = groupLabels[type];
            searchDropdown.appendChild(gl);

            group.forEach(function (r) {
                var a = document.createElement('a');
                a.className = 'search-item';
                a.href = '/' + r.incident.module + '/incidents/' + r.incident.id;

                var icon = document.createElement('span');
                icon.textContent = groupIcons[type] || '•';

                var label = document.createElement('span');
                label.className = 'search-item-label';
                label.textContent = r.label;

                var meta = document.createElement('span');
                meta.className = 'search-item-meta';
                if (type === 'ioc') {
                    meta.textContent = r.iocType || '';
                } else {
                    meta.textContent = (r.incident.severity || '').toUpperCase();
                    meta.style.color = severityColor(r.incident.severity);
                }

                a.appendChild(icon);
                a.appendChild(label);
                a.appendChild(meta);
                searchDropdown.appendChild(a);
                items.push(a);
            });

            var div = document.createElement('div');
            div.className = 'search-divider';
            searchDropdown.appendChild(div);
        });

        var footer = document.createElement('div');
        footer.className = 'search-footer';
        footer.textContent = 'Press Enter to search everything for "' + escText(query) + '" →';
        searchDropdown.appendChild(footer);

        var hint = document.createElement('div');
        hint.className = 'search-hint';
        hint.textContent = '↑↓ navigate · Enter open · Esc close';
        searchDropdown.appendChild(hint);

        searchDropdown.classList.add('open');
        activeIdx = -1;
        return items;
    }

    var dropdownItems = [];

    function runSearch(q) {
        if (q.length < 1) { searchDropdown.classList.remove('open'); return; }
        var ql = q.toLowerCase();
        var results = [];
        var seen = new Set();

        incidentIndex.forEach(function (inc) {
            (inc.packages || []).forEach(function (pkg) {
                if (pkg.toLowerCase().includes(ql)) {
                    var key = 'pkg:' + pkg;
                    if (!seen.has(key)) { seen.add(key); results.push({ type: 'package', label: pkg, incident: inc }); }
                }
            });
            if (inc.campaign && inc.campaign.toLowerCase().includes(ql)) {
                var key = 'campaign:' + inc.campaign;
                if (!seen.has(key)) { seen.add(key); results.push({ type: 'campaign', label: inc.campaign, incident: inc }); }
            }
            if (inc.actor && inc.actor.toLowerCase().includes(ql)) {
                var key = 'actor:' + inc.actor;
                if (!seen.has(key)) { seen.add(key); results.push({ type: 'actor', label: inc.actor, incident: inc }); }
            }
            (inc.iocs || []).forEach(function (ioc) {
                if (ioc.value.toLowerCase().includes(ql)) {
                    var key = 'ioc:' + ioc.value;
                    if (!seen.has(key)) { seen.add(key); results.push({ type: 'ioc', label: ioc.value, iocType: ioc.type, incident: inc }); }
                }
            });
        });

        dropdownItems = buildDropdown(results.slice(0, 8), q) || [];
    }

    searchInput.addEventListener('input', function () { runSearch(searchInput.value.trim()); });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { searchDropdown.classList.remove('open'); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = Math.min(activeIdx + 1, dropdownItems.length - 1);
            dropdownItems.forEach(function (el, i) { el.classList.toggle('active', i === activeIdx); });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, -1);
            dropdownItems.forEach(function (el, i) { el.classList.toggle('active', i === activeIdx); });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && dropdownItems[activeIdx]) {
                dropdownItems[activeIdx].click();
            } else {
                var q = searchInput.value.trim();
                if (q) window.location.href = '/search?q=' + encodeURIComponent(q);
            }
        }
    });

    document.addEventListener('click', function (e) {
        if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
            searchDropdown.classList.remove('open');
        }
    });

})();
