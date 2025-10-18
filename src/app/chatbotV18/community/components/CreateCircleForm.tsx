'use client';

import React, { useState } from 'react';
import { CreateCircleFormProps, CreateCircleRequest } from '../types/community';
import { Plus, Minus, Lock } from 'lucide-react';

export default function CreateCircleForm({ onSubmit, loading }: CreateCircleFormProps) {
  const [formData, setFormData] = useState<CreateCircleRequest>({
    name: '',
    display_name: '',
    description: '',
    rules: [],
    is_private: true, // Default to private since public option is temporarily disabled
    requires_approval: true, // Private circles require approval by default
  });

  const [newRule, setNewRule] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateName = (name: string) => {
    const nameRegex = /^[a-z0-9_-]+$/;
    if (!name) return 'Circle name is required';
    if (name.length < 3) return 'Circle name must be at least 3 characters';
    if (name.length > 21) return 'Circle name must be 21 characters or less';
    if (!nameRegex.test(name)) return 'Circle name can only contain lowercase letters, numbers, underscores, and hyphens';
    return '';
  };

  const validateDisplayName = (displayName: string) => {
    if (!displayName) return 'Display name is required';
    if (displayName.length < 3) return 'Display name must be at least 3 characters';
    if (displayName.length > 50) return 'Display name must be 50 characters or less';
    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    // Validate fields
    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;

    const displayNameError = validateDisplayName(formData.display_name);
    if (displayNameError) newErrors.display_name = displayNameError;

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof CreateCircleRequest, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addRule = () => {
    if (newRule.trim() && formData.rules && formData.rules.length < 10) {
      setFormData(prev => ({
        ...prev,
        rules: [...(prev.rules || []), newRule.trim()]
      }));
      setNewRule('');
    }
  };

  const removeRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).filter((_, i) => i !== index)
    }));
  };

  const generateNameFromDisplayName = (displayName: string) => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 21);
  };

  const handleDisplayNameChange = (value: string) => {
    handleInputChange('display_name', value);

    // Auto-generate name if it's empty or matches the previous auto-generated value
    if (!formData.name || formData.name === generateNameFromDisplayName(formData.display_name)) {
      handleInputChange('name', generateNameFromDisplayName(value));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Display Name */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Circle Display Name *
          </label>
          <input
            type="text"
            id="display_name"
            value={formData.display_name}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="e.g., Mental Health Support"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.display_name ? 'border-red-500' : 'border-gray-300'
              }`}
            disabled={loading}
          />
          {errors.display_name && (
            <p className="text-red-500 text-sm mt-1">{errors.display_name}</p>
          )}
        </div>

        {/* Name (URL identifier) */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Circle Name * <span className="text-gray-500">(URL identifier)</span>
          </label>
          <div className="flex items-center">
            <span className="text-gray-500 dark:text-gray-400 text-sm mr-1">c/</span>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="mental_health_support"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              disabled={loading}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            3-21 characters. Lowercase letters, numbers, underscores, and hyphens only.
          </p>
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="What is this circle about? What kind of discussions happen here?"
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none ${errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            disabled={loading}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Optional. Help others understand what your circle is about.
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formData.description?.length || 0}/500
            </span>
          </div>
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        {/* Privacy Setting */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Circle Privacy
          </label>
          <div className="space-y-3">
            {/* TODO: Re-enable public circles in future release */}
            {/*
            <div
              className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${!formData.is_private
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              onClick={() => handleInputChange('is_private', false)}
            >
              <input
                type="radio"
                name="privacy"
                checked={!formData.is_private}
                onChange={() => handleInputChange('is_private', false)}
                className="mt-1"
                disabled={loading}
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Public</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Anyone can view posts and join this circle.
                </p>
              </div>
            </div>
            */}

            <div
              className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.is_private
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              onClick={() => {
                handleInputChange('is_private', true);
                handleInputChange('requires_approval', true);
              }}
            >
              <input
                type="radio"
                name="privacy"
                checked={formData.is_private}
                onChange={() => {
                  handleInputChange('is_private', true);
                  handleInputChange('requires_approval', true);
                }}
                className="mt-1"
                disabled={loading}
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-orange-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Private</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Only members can view posts. Requires application to join.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Circle Rules <span className="text-gray-500">(optional)</span>
          </label>

          {/* Add Rule Input */}
          <div className="flex space-x-2 mb-3">
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="Add a rule for this circle..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
            />
            <button
              type="button"
              onClick={addRule}
              disabled={!newRule.trim() || (formData.rules && formData.rules.length >= 10) || loading}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Rules List */}
          {formData.rules && formData.rules.length > 0 && (
            <div className="space-y-2">
              {(formData.rules || []).map((rule, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                    {index + 1}. {rule}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRule(index)}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 disabled:text-gray-400 transition-colors ml-2"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Add rules to help maintain a positive environment. Maximum 10 rules.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={loading || !formData.name || !formData.display_name}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Creating...' : 'Create Circle'}
          </button>
        </div>
      </form>
    </div>
  );
}