// Global notification fallbacks
window.showSuccess = window.showSuccess || ((msg) => console.log('✅', msg));
window.showError = window.showError || ((msg) => console.error('❌', msg));
window.showInfo = window.showInfo || ((msg) => console.log('ℹ️', msg));

class ExperimentUI {
    constructor() {
        this.config = { backendUrl: window.location.origin };
        this.gateway = window.location.origin;
        this.init();
    }

    setStatus(state, text) {
        const status = document.getElementById('status');
        const icon = document.getElementById('status-icon');
        const textEl = document.getElementById('status-text');

        icon.className = 'status-icon';
        status.className = 'status';
        if (state) status.classList.add(state);
        if (text) textEl.textContent = text;
    }

    resetResults() {
        const resultsSection = document.getElementById('results');
        const resultsContent = document.getElementById('results-content');
        resultsSection.classList.add('hidden');
        resultsContent.innerHTML = '';
    }

    async init() {
        console.log('Starting ExperimentUI...');
        this.setStatus('loading', 'Initializing...');

        this.renderCheckboxes();
        await Promise.all([this.loadConfig(), this.loadModels()]);

        this.attachEvents();
        this.toggleSubmit();
        this.setStatus('success', 'Ready');
        showSuccess(' UI Ready!');
    }

    renderCheckboxes() {
        const temps = [0.1, 0.3, 0.5, 0.7, 1.0];
        const tokens = [250, 512, 1024, 2048];

        document.getElementById('temperature-grid').innerHTML = temps.map(t =>
            `<label class="checkbox-item"><input type="checkbox" name="temperature" value="${t}"><span>${t}</span></label>`
        ).join('');

        document.getElementById('max-tokens-grid').innerHTML = tokens.map(tk =>
            `<label class="checkbox-item"><input type="checkbox" name="max_tokens" value="${tk}"><span>${tk}</span></label>`
        ).join('');

        document.querySelector('input[value="0.5"]').checked = true;
        document.querySelector('input[value="1024"]').checked = true;
    }

    async loadConfig() {
        try {
            const res = await fetch(`${this.gateway}/api/config`);
            this.config = await res.json();
        } catch (e) {
            console.warn('Config failed:', e);
            this.config.backendUrl = this.gateway;
        }
    }

    async loadModels() {
        console.log(' Fetching models from:', `${this.gateway}/api/litellm/models`);
        this.setStatus('loading', 'Loading models...');

        try {
            const res = await fetch(`${this.gateway}/api/litellm/models`);
            const data = await res.json();
            console.log(' API Response:', data);

            let models = [];
            if (Array.isArray(data)) models = data;
            else if (data.models && Array.isArray(data.models)) models = data.models;
            else if (data.model_list && Array.isArray(data.model_list)) models = data.model_list;
            else if (data.data && Array.isArray(data.data)) models = data.data.map(m => m.id || m.model);
            else if (typeof data === 'string') models = data.split(',').map(m => m.trim());

            console.log(' Extracted models:', models.slice(0, 5));

            if (!models.length) throw new Error('No models found');

            const grid = document.getElementById('model-grid');
            grid.innerHTML = models.slice(0, 12).map(model => {
                const displayName = model.replace(/^[^\/]+\//, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `<label class="checkbox-item"><input type="checkbox" name="model" value="${model}"><span>${displayName}</span></label>`;
            }).join('');

            Array.from(grid.querySelectorAll('input[name="model"]')).slice(0, 2).forEach(cb => cb.checked = true);
            showSuccess(`✅ ${models.length} models loaded!`);

        } catch (error) {
            console.error('❌ Models failed:', error);
            document.getElementById('model-grid').innerHTML = `
                <label class="checkbox-item"><input type="checkbox" name="model" value="gpt-4o-mini" checked><span>GPT-4o Mini</span></label>
                <label class="checkbox-item"><input type="checkbox" name="model" value="gpt-4o" checked><span>GPT-4o</span></label>
            `;
            showInfo('Using fallback models');
        }
    }

    attachEvents() {
        ['prompt-1', 'prompt-2', 'prompt-3'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.toggleSubmit());
        });

        document.addEventListener('change', e => {
            if (e.target.matches('input[type="checkbox"]')) this.toggleSubmit();
        });

        document.getElementById('submit-btn').addEventListener('click', () => this.submitExperiments());
    }

    toggleSubmit() {
        const models = document.querySelectorAll('input[name="model"]:checked');
        const prompts = ['prompt-1','prompt-2','prompt-3'].some(id => document.getElementById(id).value.trim());
        const temps = document.querySelectorAll('input[name="temperature"]:checked');
        const tokens = document.querySelectorAll('input[name="max_tokens"]:checked');

        const btn = document.getElementById('submit-btn');
        const ready = models.length && prompts && temps.length && tokens.length;

        btn.disabled = !ready;
        if (ready) {
            btn.textContent = ` Run (${models.length} models)`;
        } else {
            btn.textContent = ' Run Experiments';
        }
    }

    async submitExperiments() {
        this.resetResults();
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.textContent = ' Processing...';
        this.setStatus('running', ' Running experiments...');

        try {
            const payload = {
                models: Array.from(document.querySelectorAll('input[name="model"]:checked')).map(cb => cb.value),
                prompts: ['prompt-1','prompt-2','prompt-3'].map(id => document.getElementById(id).value.trim()).filter(Boolean),
                temperatures: Array.from(document.querySelectorAll('input[name="temperature"]:checked')).map(cb => parseFloat(cb.value)),
                max_tokens: Array.from(document.querySelectorAll('input[name="max_tokens"]:checked')).map(cb => parseInt(cb.value)),
                timestamp: new Date().toISOString()
            };

            showInfo(`Running ${payload.models.length * payload.prompts.length * payload.temperatures.length * payload.max_tokens.length} combos...`);

            const res = await fetch(`${this.config.backendUrl}/api/experiments`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();

            this.showResults(result);
            this.setStatus('success', ' COMPLETED!');

        } catch (e) {
            this.setStatus('error', `❌ Failed: ${e.message}`);
            showError(e.message);
            btn.textContent = ' Run Experiments';
        } finally {
            btn.disabled = false;
            btn.textContent = ' Run Experiments';
        }
    }

    showResults(data) {
        document.getElementById('results').classList.remove('hidden');
        const best = data.best_config;
        const topCombos = data.all_results || [];

        document.getElementById('results-content').innerHTML = `
            <div class="result-card" style="background: white; padding: 32px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); margin: 20px 0;">
                <h3 style="
                    margin: 0 0 24px 0;
                    font-size: 28px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">🏆 BEST CONFIGURATION</h3>

                <div class="metrics-grid" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 20px;
                    padding: 28px;
                    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
                    border-radius: 16px;
                    color: #ecf0f1 !important;
                    font-weight: 500;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
                    border: 1px solid #34495e;
                    margin-bottom: 32px;
                ">
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #3498db;">
                        <strong style="color: #3498db; font-size: 14px; display: block; margin-bottom: 8px;">Model:</strong>
                        <span style="font-size: 18px; font-weight: 700; color: #ecf0f1;">${best.model_name || 'N/A'}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #e74c3c;">
                        <strong style="color: #e74c3c; font-size: 14px; display: block; margin-bottom: 8px;">Prompt:</strong>
                        <span style="font-size: 18px; font-weight: 700; color: #ecf0f1;">${best.prompt_name || 'N/A'}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #f39c12;">
                        <strong style="color: #f39c12; font-size: 14px; display: block; margin-bottom: 8px;">Temperature:</strong>
                        <span style="font-size: 18px; font-weight: 700; color: #ecf0f1;">${best.temperature || 'N/A'}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #27ae60;">
                        <strong style="color: #27ae60; font-size: 14px; display: block; margin-bottom: 8px;">Max Tokens:</strong>
                        <span style="font-size: 18px; font-weight: 700; color: #ecf0f1;">${best.max_tokens || 'N/A'}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #9b59b6;">
                        <strong style="color: #9b59b6; font-size: 14px; display: block; margin-bottom: 8px;">Peak Score:</strong>
                        <span style="font-size: 22px; font-weight: 800; color: #f1c40f; text-shadow: 0 2px 4px rgba(241,196,15,0.3);">
                            ${best.weighted_score?.toFixed(3) || 'N/A'}
                        </span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #e67e22;">
                        <strong style="color: #e67e22; font-size: 14px; display: block; margin-bottom: 8px;">Tests:</strong>
                        <span style="font-size: 18px; font-weight: 700; color: #ecf0f1;">${best.valid_tests || 0}/${best.total_tests || 0}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; border-left: 4px solid #1abc9c;">
                        <strong style="color: #1abc9c; font-size: 14px; display: block; margin-bottom: 8px;">Total Combos:</strong>
                        <span style="font-size: 22px; font-weight: 800; color: #ecf0f1;">${data.total_combos || 0}</span>
                    </div>
                </div>


                <details open>
                    <summary style="font-size: 18px; font-weight: 600; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin-bottom: 16px; cursor: pointer;">
                         TOP ${Math.min(topCombos.length, 10)} COMBINATIONS (by Weighted Score)
                    </summary>
                    <div class="test-results" style="overflow-x: auto; background: #f8f9fa; border-radius: 12px; padding: 16px;">
                        <table style="
                            width: 100%;
                            border-collapse: collapse;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            font-size: 14px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            border-radius: 12px;
                            overflow: hidden;
                            background: white;
                        ">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                    <th style="padding: 16px 12px; text-align: left; min-width: 60px; font-weight: 600;">Rank</th>
                                    <th style="padding: 16px 12px; text-align: left; min-width: 180px; font-weight: 600;">Model</th>
                                    <th style="padding: 16px 12px; text-align: left; min-width: 120px; font-weight: 600;">Prompt</th>
                                    <th style="padding: 16px 8px; text-align: center; min-width: 100px; font-weight: 600;">Temperature</th>
                                    <th style="padding: 16px 8px; text-align: center; min-width: 100px; font-weight: 600;">Tokens</th>
                                    <th style="padding: 16px 8px; text-align: center; min-width: 120px; font-weight: 600;">Weighted Score</th>
                                    <th style="padding: 16px 8px; text-align: center; min-width: 140px; font-weight: 600;">Response Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topCombos.length > 0
                                    ? topCombos.map((combo, idx) => `
                                        <tr style="
                                            border-bottom: 1px solid #e9ecef;
                                            transition: all 0.2s ease;
                                            ${combo.rank === 1 ? 'background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%) !important;' : ''}
                                        ">
                                            <td style="padding: 16px 12px; font-weight: 700; font-size: 15px; color: ${combo.rank === 1 ? '#155724' : '#495057'};">
                                                #${combo.rank || (idx+1)}
                                            </td>
                                            <td style="padding: 16px 12px; color: #495057; font-weight: 500;">${combo.model_name || 'N/A'}</td>
                                            <td style="padding: 16px 12px; color: #495057;">${combo.prompt_name || 'N/A'}</td>
                                            <td style="padding: 16px 8px; text-align: center; font-family: monospace; color: #6c757d; font-weight: 500;">
                                                ${combo.temperature || 'N/A'}
                                            </td>
                                            <td style="padding: 16px 8px; text-align: center; font-family: monospace; color: #6c757d; font-weight: 500;">
                                                ${combo.max_tokens || 'N/A'}
                                            </td>
                                            <td style="padding: 16px 8px; text-align: center; font-weight: 700; font-size: 15px; color: #007bff;">
                                                ${combo.weighted_score?.toFixed(3) || 'N/A'}
                                            </td>
                                            <td style="padding: 16px 8px; text-align: center; font-family: monospace; color: #dc3545; font-weight: 500;">
                                                ${combo.metrics?.response_time_seconds?.toFixed(3) || 'N/A'}s
                                            </td>
                                        </tr>
                                    `).join('')
                                    : `<tr><td colspan="7" style="padding: 40px; text-align: center; color: #6c757d; font-style: italic; font-size: 16px;">No results yet</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </details>

                <!-- ✅ PERFECTLY VISIBLE METRICS BREAKDOWN -->
                <details>
                    <summary style="font-size: 18px; font-weight: 600; padding: 16px; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: #ecf0f1; border-radius: 12px; margin: 24px 0 16px 0; cursor: pointer;">
                         Metrics Breakdown (Best Config)
                    </summary>
                    <div class="metrics-breakdown" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                        gap: 20px;
                        padding: 24px;
                        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                        border-radius: 16px;
                        color: #ecf0f1 !important;
                        font-weight: 500;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        border: 1px solid #34495e;
                    ">
                        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; border-left: 4px solid #3498db;">
                            <strong style="color: #3498db; font-size: 14px;">Cosine Similarity:</strong><br>
                            <span style="font-size: 24px; font-weight: 700; color: #ecf0f1; letter-spacing: -0.5px;">${best.avg_cosine_similarity?.toFixed(3) || 'N/A'}</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; border-left: 4px solid #e74c3c;">
                            <strong style="color: #e74c3c; font-size: 14px;">Context Dot Product:</strong><br>
                            <span style="font-size: 24px; font-weight: 700; color: #ecf0f1; letter-spacing: -0.5px;">${best.avg_dot_product?.toFixed(3) || 'N/A'}</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; border-left: 4px solid #f39c12;">
                            <strong style="color: #f39c12; font-size: 14px;">Avg Response Time:</strong><br>
                            <span style="font-size: 24px; font-weight: 700; color: #ecf0f1; letter-spacing: -0.5px;">${best.avg_response_time || 'N/A'}s</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; border-left: 4px solid #27ae60;">
                            <strong style="color: #27ae60; font-size: 14px;">Avg Length:</strong><br>
                            <span style="font-size: 24px; font-weight: 700; color: #ecf0f1; letter-spacing: -0.5px;">${best.avg_response_length || 'N/A'} words</span>
                        </div>
                    </div>
                </details>

                <details>
                    <summary style="font-size: 16px; font-weight: 600; padding: 16px; background: linear-gradient(135deg, #1e1e1e 0%, #2c3e50 100%); color: #d4d4d4; border-radius: 12px; cursor: pointer;">
                         Raw JSON Response
                    </summary>
                    <pre style="
                        background: #1e1e1e !important;
                        color: #d4d4d4 !important;
                        padding: 20px;
                        border-radius: 12px;
                        overflow-x: auto;
                        font-size: 13px;
                        font-family: 'Fira Code', 'Monaco', 'Consolas', monospace !important;
                        border-left: 4px solid #007bff;
                        box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
                        max-height: 400px;
                        overflow-y: auto;
                        margin-top: 16px;
                        line-height: 1.5;
                    ">${JSON.stringify(data, null, 2)}</pre>
                </details>
            </div>
        `;

        showSuccess(` COMPLETE! Best: ${best.model_name || 'N/A'} (${best.weighted_score?.toFixed(3) || 'N/A'}) | ${data.total_combos || 0} combos`);
    }

}

document.addEventListener('DOMContentLoaded', () => new ExperimentUI());
