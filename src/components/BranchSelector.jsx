import { useEffect, useState } from 'react';
import { getAllBranches } from '../services/branchService';

/**
 * Branch Selector Component
 * Dropdown to filter data by branch (admin only).
 * Uses project design tokens for consistent styling.
 */
export default function BranchSelector({ currentUser, selectedBranch, onBranchChange }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const allBranches = await getAllBranches();
      setBranches(allBranches.filter(b => b.isActive));
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Only show for admins
  if (currentUser?.role !== 'admin') {
    return null;
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-foreground mb-2">
        Filter by Branch
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <select
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-background border-2 border-border text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">All branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}{branch.location ? ` — ${branch.location}` : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedBranch && (
          <button
            type="button"
            onClick={() => onBranchChange('')}
            className="px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg border border-primary/30 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
