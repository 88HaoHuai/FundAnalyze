import { useState, useEffect } from 'react';
import { X, Save, Edit2 } from 'lucide-react';

export function FundManager({ groups, onUpdate, onClose }) {
    // We'll just edit the JSON directly for groups, as it's the most flexible way for now
    // to add/remove groups or move funds.
    const [jsonContent, setJsonContent] = useState(JSON.stringify(groups, null, 2));
    const [error, setError] = useState(null);

    const handleSave = () => {
        try {
            const parsed = JSON.parse(jsonContent);
            if (!Array.isArray(parsed)) throw new Error("Root must be an array of groups");
            onUpdate(parsed);
            onClose(); // Auto close on save for this mode
        } catch (e) {
            setError("Invalid JSON format: " + e.message);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--spacing-4)'
        }} onClick={onClose}>
            <div
                className="card"
                style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-between" style={{ marginBottom: 'var(--spacing-4)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold' }}>Fund Group Manager</h2>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: 'var(--spacing-2)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                    <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                        Edit the configuration JSON directly. You can create new groups by adding objects like <code>{`{ "name": "New Group", "codes": [] }`}</code>.
                    </p>
                    <textarea
                        className="input"
                        style={{ flex: 1, minHeight: '300px', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', whiteSpace: 'pre' }}
                        value={jsonContent}
                        onChange={e => {
                            setJsonContent(e.target.value);
                            setError(null);
                        }}
                    />
                    {error && <p className="text-danger">{error}</p>}
                </div>

                <div className="flex-between" style={{ marginTop: 'var(--spacing-6)' }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn" onClick={handleSave}>
                        <Save size={18} style={{ marginRight: '4px' }} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
