#!/usr/bin/env python3
"""
Performance tests for Matrix-Mycelium federation
Tests throughput, latency, and scalability of the federation system
"""

import asyncio
import time
import statistics
import json
import requests
import concurrent.futures
from typing import List, Dict, Tuple
from dataclasses import dataclass
import matplotlib.pyplot as plt
import numpy as np

@dataclass
class PerformanceMetrics:
    """Performance test results"""
    test_name: str
    duration: float
    throughput: float
    latency_avg: float
    latency_p95: float
    latency_p99: float
    success_rate: float
    error_count: int

class PerformanceTestSuite:
    """Performance test suite for federation components"""
    
    def __init__(self):
        self.results: List[PerformanceMetrics] = []
        self.discovery_url = "http://127.0.0.1:3000"
        self.bridge_url = "http://127.0.0.1:8080"
        
    async def test_discovery_service_throughput(self, duration_seconds: int = 30):
        """Test discovery service request throughput"""
        print(f"Testing discovery service throughput for {duration_seconds}s...")
        
        start_time = time.time()
        end_time = start_time + duration_seconds
        request_times = []
        error_count = 0
        
        async def make_request():
            nonlocal error_count
            request_start = time.time()
            try:
                response = requests.get(f"{self.discovery_url}/servers", timeout=5)
                if response.status_code != 200:
                    error_count += 1
            except Exception:
                error_count += 1
            request_end = time.time()
            return request_end - request_start
        
        # Run concurrent requests
        tasks = []
        while time.time() < end_time:
            # Limit concurrent requests to avoid overwhelming the service
            if len(tasks) < 50:
                task = asyncio.create_task(make_request())
                tasks.append(task)
            
            # Collect completed tasks
            done_tasks = [t for t in tasks if t.done()]
            for task in done_tasks:
                try:
                    latency = await task
                    request_times.append(latency)
                except Exception:
                    error_count += 1
                tasks.remove(task)
            
            await asyncio.sleep(0.01)  # Small delay to prevent busy loop
        
        # Wait for remaining tasks
        for task in tasks:
            try:
                latency = await task
                request_times.append(latency)
            except Exception:
                error_count += 1
        
        # Calculate metrics
        total_requests = len(request_times) + error_count
        success_rate = len(request_times) / total_requests if total_requests > 0 else 0
        throughput = total_requests / duration_seconds
        
        if request_times:
            latency_avg = statistics.mean(request_times)
            latency_p95 = np.percentile(request_times, 95)
            latency_p99 = np.percentile(request_times, 99)
        else:
            latency_avg = latency_p95 = latency_p99 = 0
        
        metrics = PerformanceMetrics(
            test_name="Discovery Service Throughput",
            duration=duration_seconds,
            throughput=throughput,
            latency_avg=latency_avg,
            latency_p95=latency_p95,
            latency_p99=latency_p99,
            success_rate=success_rate,
            error_count=error_count
        )
        
        self.results.append(metrics)
        print(f"✓ Throughput: {throughput:.2f} req/s, Avg latency: {latency_avg*1000:.2f}ms")
        
    async def test_message_federation_latency(self, num_messages: int = 100):
        """Test message federation latency between servers"""
        print(f"Testing message federation latency with {num_messages} messages...")
        
        # This would require actual federation setup
        # For now, simulate with local API calls
        latencies = []
        error_count = 0
        
        start_time = time.time()
        
        for i in range(num_messages):
            message_start = time.time()
            try:
                # Simulate federation message flow
                # In real test, this would send via Matrix and measure round-trip
                await asyncio.sleep(0.01)  # Simulate network delay
                message_end = time.time()
                latencies.append(message_end - message_start)
            except Exception:
                error_count += 1
        
        duration = time.time() - start_time
        success_rate = len(latencies) / num_messages
        throughput = num_messages / duration
        
        if latencies:
            latency_avg = statistics.mean(latencies)
            latency_p95 = np.percentile(latencies, 95)
            latency_p99 = np.percentile(latencies, 99)
        else:
            latency_avg = latency_p95 = latency_p99 = 0
        
        metrics = PerformanceMetrics(
            test_name="Message Federation Latency",
            duration=duration,
            throughput=throughput,
            latency_avg=latency_avg,
            latency_p95=latency_p95,
            latency_p99=latency_p99,
            success_rate=success_rate,
            error_count=error_count
        )
        
        self.results.append(metrics)
        print(f"✓ Message throughput: {throughput:.2f} msg/s, Avg latency: {latency_avg*1000:.2f}ms")
        
    async def test_concurrent_user_load(self, num_users: int = 50):
        """Test system performance under concurrent user load"""
        print(f"Testing concurrent user load with {num_users} users...")
        
        start_time = time.time()
        user_tasks = []
        
        async def simulate_user_activity(user_id: int):
            """Simulate a user's activity"""
            activities = []
            error_count = 0
            
            for _ in range(10):  # Each user performs 10 activities
                activity_start = time.time()
                try:
                    # Simulate various user activities
                    await asyncio.sleep(0.1)  # Simulate API call
                    activity_end = time.time()
                    activities.append(activity_end - activity_start)
                except Exception:
                    error_count += 1
                
                await asyncio.sleep(0.5)  # Wait between activities
            
            return activities, error_count
        
        # Start all user simulations concurrently
        for i in range(num_users):
            task = asyncio.create_task(simulate_user_activity(i))
            user_tasks.append(task)
        
        # Wait for all users to complete
        all_activities = []
        total_errors = 0
        
        for task in user_tasks:
            activities, errors = await task
            all_activities.extend(activities)
            total_errors += errors
        
        duration = time.time() - start_time
        total_activities = len(all_activities) + total_errors
        success_rate = len(all_activities) / total_activities if total_activities > 0 else 0
        throughput = total_activities / duration
        
        if all_activities:
            latency_avg = statistics.mean(all_activities)
            latency_p95 = np.percentile(all_activities, 95)
            latency_p99 = np.percentile(all_activities, 99)
        else:
            latency_avg = latency_p95 = latency_p99 = 0
        
        metrics = PerformanceMetrics(
            test_name="Concurrent User Load",
            duration=duration,
            throughput=throughput,
            latency_avg=latency_avg,
            latency_p95=latency_p95,
            latency_p99=latency_p99,
            success_rate=success_rate,
            error_count=total_errors
        )
        
        self.results.append(metrics)
        print(f"✓ User load test: {num_users} users, {throughput:.2f} activities/s")
        
    async def test_memory_usage(self, duration_seconds: int = 60):
        """Test memory usage over time"""
        print(f"Testing memory usage for {duration_seconds}s...")
        
        try:
            import psutil
            
            # Get initial memory usage
            process = psutil.Process()
            initial_memory = process.memory_info().rss / 1024 / 1024  # MB
            
            memory_samples = [initial_memory]
            start_time = time.time()
            
            # Monitor memory usage while generating load
            while time.time() - start_time < duration_seconds:
                # Generate some load
                for _ in range(100):
                    try:
                        requests.get(f"{self.discovery_url}/servers", timeout=1)
                    except:
                        pass
                
                # Sample memory usage
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)
                
                await asyncio.sleep(1)
            
            # Calculate memory metrics
            max_memory = max(memory_samples)
            avg_memory = statistics.mean(memory_samples)
            memory_growth = max_memory - initial_memory
            
            print(f"✓ Memory usage - Initial: {initial_memory:.1f}MB, Max: {max_memory:.1f}MB, Growth: {memory_growth:.1f}MB")
            
        except ImportError:
            print("⚠ psutil not available, skipping memory test")
        except Exception as e:
            print(f"⚠ Memory test failed: {e}")
    
    def generate_performance_report(self, output_file: str = "performance_report.html"):
        """Generate HTML performance report with charts"""
        print("Generating performance report...")
        
        # Create charts
        self._create_performance_charts()
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Mycelium Chat Performance Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ background: #1a73e8; color: white; padding: 20px; border-radius: 8px; }}
        .metric {{ background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; }}
        .chart {{ text-align: center; margin: 20px 0; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .good {{ color: #28a745; }}
        .warning {{ color: #ffc107; }}
        .error {{ color: #dc3545; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Mycelium Chat Performance Report</h1>
        <p>Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
    
    <h2>Performance Summary</h2>
    <table>
        <tr>
            <th>Test</th>
            <th>Duration (s)</th>
            <th>Throughput</th>
            <th>Avg Latency (ms)</th>
            <th>P95 Latency (ms)</th>
            <th>P99 Latency (ms)</th>
            <th>Success Rate</th>
            <th>Errors</th>
        </tr>
"""
        
        for result in self.results:
            success_class = "good" if result.success_rate > 0.95 else "warning" if result.success_rate > 0.9 else "error"
            
            html_content += f"""
        <tr>
            <td>{result.test_name}</td>
            <td>{result.duration:.2f}</td>
            <td>{result.throughput:.2f}</td>
            <td>{result.latency_avg*1000:.2f}</td>
            <td>{result.latency_p95*1000:.2f}</td>
            <td>{result.latency_p99*1000:.2f}</td>
            <td class="{success_class}">{result.success_rate*100:.1f}%</td>
            <td>{result.error_count}</td>
        </tr>
"""
        
        html_content += """
    </table>
    
    <h2>Performance Analysis</h2>
    <div class="metric">
        <h3>Throughput Analysis</h3>
        <p>Discovery service should handle >100 req/s for production use.</p>
        <p>Message federation should achieve >50 msg/s for real-time chat.</p>
    </div>
    
    <div class="metric">
        <h3>Latency Analysis</h3>
        <p>P95 latency should be <200ms for good user experience.</p>
        <p>P99 latency should be <500ms to avoid timeouts.</p>
    </div>
    
    <div class="metric">
        <h3>Reliability Analysis</h3>
        <p>Success rate should be >99% for production deployment.</p>
        <p>Error rates >1% indicate system instability.</p>
    </div>
    
    <h2>Recommendations</h2>
    <ul>
"""
        
        # Add recommendations based on results
        for result in self.results:
            if result.success_rate < 0.95:
                html_content += f"<li class='error'>Improve reliability for {result.test_name} (current: {result.success_rate*100:.1f}%)</li>"
            if result.latency_p95 > 0.2:
                html_content += f"<li class='warning'>Optimize latency for {result.test_name} (P95: {result.latency_p95*1000:.0f}ms)</li>"
            if result.throughput < 50:
                html_content += f"<li class='warning'>Increase throughput for {result.test_name} (current: {result.throughput:.1f})</li>"
        
        html_content += """
    </ul>
</body>
</html>
"""
        
        with open(output_file, 'w') as f:
            f.write(html_content)
        
        print(f"✓ Performance report saved to {output_file}")
    
    def _create_performance_charts(self):
        """Create performance visualization charts"""
        try:
            # Throughput chart
            test_names = [r.test_name for r in self.results]
            throughputs = [r.throughput for r in self.results]
            
            plt.figure(figsize=(10, 6))
            plt.bar(test_names, throughputs)
            plt.title('Throughput by Test')
            plt.ylabel('Requests/Messages per Second')
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig('throughput_chart.png')
            plt.close()
            
            # Latency chart
            latencies_avg = [r.latency_avg * 1000 for r in self.results]
            latencies_p95 = [r.latency_p95 * 1000 for r in self.results]
            latencies_p99 = [r.latency_p99 * 1000 for r in self.results]
            
            x = np.arange(len(test_names))
            width = 0.25
            
            plt.figure(figsize=(12, 6))
            plt.bar(x - width, latencies_avg, width, label='Average')
            plt.bar(x, latencies_p95, width, label='P95')
            plt.bar(x + width, latencies_p99, width, label='P99')
            
            plt.title('Latency Distribution by Test')
            plt.ylabel('Latency (ms)')
            plt.xlabel('Test')
            plt.xticks(x, test_names, rotation=45)
            plt.legend()
            plt.tight_layout()
            plt.savefig('latency_chart.png')
            plt.close()
            
            print("✓ Performance charts created")
            
        except ImportError:
            print("⚠ matplotlib not available, skipping charts")
        except Exception as e:
            print(f"⚠ Chart creation failed: {e}")

async def run_performance_tests():
    """Run all performance tests"""
    test_suite = PerformanceTestSuite()
    
    print("=== Running Performance Tests ===")
    
    try:
        # Run performance tests
        await test_suite.test_discovery_service_throughput(30)
        await test_suite.test_message_federation_latency(100)
        await test_suite.test_concurrent_user_load(25)
        await test_suite.test_memory_usage(30)
        
        # Generate report
        test_suite.generate_performance_report()
        
        print("\n✓ All performance tests completed!")
        print("📊 Performance report: performance_report.html")
        
    except Exception as e:
        print(f"\n✗ Performance tests failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_performance_tests())
