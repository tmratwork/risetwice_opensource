"use client";

import React, { useState } from 'react';
import ProfileAnalysisTab from './profile-analysis';
import ProfileMergeTab from './profile-merge';

export default function ProfileTabs() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'merge'>('analysis');

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Profile Management</h1>
      
      {/* Main tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          className={`py-2 px-4 text-md font-medium border-b-2 ${
            activeTab === 'analysis'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('analysis')}
        >
          Profile Analysis
        </button>
        <button
          className={`py-2 px-4 text-md font-medium border-b-2 ${
            activeTab === 'merge'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('merge')}
        >
          Profile Merge
        </button>
      </div>
      
      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'analysis' && <ProfileAnalysisTab />}
        {activeTab === 'merge' && <ProfileMergeTab />}
      </div>
    </div>
  );
}