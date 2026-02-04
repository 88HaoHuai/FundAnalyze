import { useState } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { fundApi } from '../services/fundApi';

export function FundSearch({ onAddFund, existingCodes }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!code || code.length !== 6) {
            setError('Please enter a valid 6-digit fund code');
            return;
        }
        if (existingCodes.includes(code)) {
            setError('Fund already added');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const fund = await fundApi.searchFund(code);
            onAddFund(fund);
            setCode('');
        } catch (err) {
            setError(err.message || 'Failed to find fund');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
            <form onSubmit={handleSubmit} className="flex-between gap-4">
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                        size={20}
                        className="text-secondary"
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                        type="text"
                        className="input"
                        style={{ paddingLeft: '40px' }}
                        placeholder="Enter Fund Code (e.g. 001632)"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        maxLength={6}
                    />
                </div>
                <button
                    type="button" // Change to button since form handles submit, but we might want a visual submit button? 
                    // Actually, let's keep it submit.
                    onClick={handleSubmit}
                    className="btn"
                    disabled={loading}
                    style={{ minWidth: '100px' }}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} style={{ marginRight: '4px' }} /> Add</>}
                </button>
            </form>
            {error && <p className="text-danger" style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>{error}</p>}
        </div>
    );
}
