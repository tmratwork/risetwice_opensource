# Timestamped Map Performance Logging Guide

## Overview

All map-related components now include comprehensive timestamped logging to help identify exactly where performance bottlenecks occur. Each log entry includes:

- **ISO Timestamp**: Exact time when the log occurred
- **Performance Time**: Milliseconds since page load (`performance.now()`)
- **Component Prefix**: Identifies which component generated the log
- **Detailed Message**: Specific information about the operation

## Log Format

```
2024-01-25T10:30:45.123Z [PERF:12345.67ms] [MapDisplay] 🗺️ [OptimizedMapDisplay] Map loaded successfully
```

**All map-related logs are now prefixed with `[MapDisplay]` followed by the specific component identifier.**

## Map-Related Log Prefixes

### [MapDisplay] 🗺️ [MapDisplay]
- Component initialization and resource counting
- Wrapper component that delegates to OptimizedMapDisplay

### [MapDisplay] 🗺️ [OptimizedMapDisplay] 
- Map creation and initialization
- Resource processing coordination
- Layer rendering and optimization
- Performance metrics and completion

### [MapDisplay] 🎯 [BatchGeocode]
- Batch geocoding initialization and completion
- Cache hit/miss statistics
- Individual batch processing
- API call timing and results

### [MapDisplay] 🔍 [BatchGeocode-X.Y]
- Individual geocoding requests (X = batch number, Y = item in batch)
- Per-request timing (e.g., "Success in 0.234s")
- Geocoding API responses and errors

### [MapDisplay] 🖼️ [MapResourcesDisplay]
- Parent component rendering and state management
- Resource fetching from API
- Data processing and filtering

### [MapDisplay] ⚡ [MapResourcesDisplay]
- UseEffect triggers and state changes
- Resource loading coordination

### [MapDisplay] 📥 [MapResourcesDisplay]
- API response timing and data reception

### [MapDisplay] 🔍 [MapResourcesDisplay]
- API response debugging and resource analysis

### [MapDisplay] 📍 [MapResourcesDisplay]
- Resource filtering and location processing

## Key Performance Checkpoints

### 1. **Component Initialization**
```
[MapDisplay] 🗺️ [MapDisplay] === USING OPTIMIZED IMPLEMENTATION === Resources count: 15
[MapDisplay] 🗺️ [OptimizedMapDisplay] === COMPONENT RENDER === Resources count: 15
```

### 2. **Map Creation**
```
[MapDisplay] 🗺️ [OptimizedMapDisplay] Creating Mapbox GL map...
[MapDisplay] ✅ [OptimizedMapDisplay] Map loaded successfully
```

### 3. **Geocoding Process**
```
[MapDisplay] 🎯 [BatchGeocode] Starting batch geocoding for 15 resources in San Diego, CA
[MapDisplay] 📊 [BatchGeocode] 3 cached, 12 new requests needed
[MapDisplay] 📍 [BatchGeocode] Processing batch 1/3 (5 resources)
[MapDisplay] 🔍 [BatchGeocode-1.1] Geocoding: Mental Health Center - "123 Main St, San Diego, CA"
[MapDisplay] ✅ [BatchGeocode-1.1] Success in 0.234s: [32.7157, -117.1611] (rooftop)
```

### 4. **Layer Rendering**
```
[MapDisplay] 🗺️ [OptimizedMapDisplay] Adding optimized layers for 15 resources
[MapDisplay] ✅ [OptimizedMapDisplay] Optimized layers added successfully in 0.045s
```

### 5. **Completion Metrics**
```
[MapDisplay] ✅ [BatchGeocode] Completed in 2.34s
[MapDisplay] 📊 [BatchGeocode] Final results: 15/15 geocoded (100%)
[MapDisplay] 📈 [BatchGeocode] Performance: 3 from cache, 12 from API
[MapDisplay] 🎉 [OptimizedMapDisplay] Complete! Processed 15 resources in 3.12s
[MapDisplay] 📈 [OptimizedMapDisplay] Performance: 3 cache hits, 12 API calls
```

## Performance Analysis Tips

### Finding Slow Operations
Search console logs for specific patterns:

1. **Total Processing Time:**
   ```
   "[MapDisplay]" AND "🎉" AND "Complete!"
   ```

2. **Geocoding Duration:**
   ```
   "[MapDisplay]" AND "✅" AND "Completed in"
   ```

3. **Individual Request Times:**
   ```
   "[MapDisplay]" AND ("Success in" OR "failed in")
   ```

4. **Cache Performance:**
   ```
   "[MapDisplay]" AND ("from cache" OR "cache hits")
   ```

### Expected Performance Improvements

- **Before Optimization:** ~150 seconds (2.5 minutes)
- **After Optimization:** ~20 seconds
- **Target Improvement:** 7.5x faster

### Monitoring Cache Effectiveness

Look for these patterns to verify caching is working:
```
[MapDisplay] 📊 [BatchGeocode] 8 cached, 2 new requests needed  // Good cache hit rate
[MapDisplay] 📈 [BatchGeocode] Performance: 8 from cache, 2 from API
```

### Identifying Rate Limiting Issues

If you see these patterns, rate limiting is working correctly:
```
[MapDisplay] ⏱️ [BatchGeocode] Waiting 200ms before next batch...
[MapDisplay] 📍 [BatchGeocode] Processing batch 2/3 (5 resources)
```

## Console Filtering

To focus on specific performance aspects, filter console logs by:

- **All map logs:** `[MapDisplay]`
- **Geocoding only:** `[MapDisplay]` AND `[BatchGeocode]`
- **Timing only:** `[MapDisplay]` AND (`in 0.` OR `Success in` OR `Completed in`)
- **Cache performance:** `[MapDisplay]` AND (`cache` OR `cached`)
- **Errors only:** `[MapDisplay]` AND (`❌` OR `failed`)

## Troubleshooting Slow Performance

1. **Check geocoding batch timing:** Look for unusually long individual request times
2. **Verify cache usage:** Ensure cache hits are occurring for repeated addresses
3. **Monitor API errors:** Watch for rate limiting or failed requests
4. **Track layer rendering:** Verify layer creation isn't taking excessive time

The timestamped logs provide a complete performance audit trail to identify exactly where optimization efforts should be focused.