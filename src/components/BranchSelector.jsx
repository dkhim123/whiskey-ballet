import { useEffect, useState } from 'react';
import { getAllBranches } from '../services/branchService';

/**
 * Branch Selector Component
 * Dropdown to filter data by branch (admin only)
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
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-foreground whitespace-nowrap">
        Filter by Branch:
      </label>
      <select
        value={selectedBranch}
        onChange={(e) => onBranchChange(e.target.value)}
        disabled={loading}
        className="px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
      >
        <option value="">All Branches</option>
        {branches.map(branch => (
          <option key={branch.id} value={branch.id}>
            {branch.name} {branch.location ? `(${branch.location})` : ''}
          </option>
        ))}
      </select>
      {selectedBranch && (
        <button
          onClick={() => onBranchChange('')}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
