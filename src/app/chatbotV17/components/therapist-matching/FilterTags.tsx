import React from 'react';

export interface FilterTag {
  id: string;
  label: string;
  type: 'specialty' | 'title' | 'gender' | 'age' | 'language' | 'location';
}

interface FilterTagsProps {
  activeTags: FilterTag[];
  onRemoveTag: (tagId: string) => void;
}

const FilterTags: React.FC<FilterTagsProps> = ({ activeTags, onRemoveTag }) => {
  if (activeTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {activeTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
        >
          {tag.label}
          <button
            onClick={() => onRemoveTag(tag.id)}
            className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            aria-label={`Remove ${tag.label} filter`}
          >
            <svg
              className="w-3 h-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
};

export default FilterTags;