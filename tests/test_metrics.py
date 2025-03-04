import time
import requests
import statistics
import pandas as pd

def run_performance_tests(queries, iterations=10):
    metrics = {
        'response_times': [],
        'confidence_scores': [],
        'relevance_rates': [],
        'source_counts': []
    }
    
    for query in queries:
        print(f"Testing query: {query}")
        for i in range(iterations):
            try:
                start_time = time.time()
                response = requests.post(
                    "http://localhost:3000/chat",
                    json={"query": query, "location": "us"},
                    headers={"Content-Type": "application/json"}
                )
                end_time = time.time()
                
                if response.status_code == 200:
                    data = response.json()
                    metrics['response_times'].append(end_time - start_time)
                    metrics['confidence_scores'].append(data.get('confidence', 0))
                    metrics['source_counts'].append(len(data.get('sources', [])))
                    print(f"Iteration {i+1}: Response time = {end_time - start_time:.2f}s")
            except Exception as e:
                print(f"Error in iteration {i+1}: {e}")
                
    return metrics

def calculate_metrics(metrics):
    summary = {
        'average_response_time': statistics.mean(metrics['response_times']) if metrics['response_times'] else 0,
        'max_response_time': max(metrics['response_times'], default=0),
        'min_response_time': min(metrics['response_times'], default=0),
        'average_confidence_score': statistics.mean(metrics['confidence_scores']) if metrics['confidence_scores'] else 0,
        'source_count_distribution': {
            'average': statistics.mean(metrics['source_counts']) if metrics['source_counts'] else 0,
            'max': max(metrics['source_counts'], default=0),
            'min': min(metrics['source_counts'], default=0),
        }
    }
    return summary

if __name__ == "__main__":
    test_queries = [
        "What is Hashimoto disease?",
        "What are the symptoms of Gaucher disease?",
        "Explain the treatment for Fabry disease.",
        "What causes Wilson's disease?",
        "How to diagnose Pompe disease?"
    ]
    
    print("Starting performance tests...")
    metrics = run_performance_tests(test_queries, iterations=3)
    summary = calculate_metrics(metrics)
    
    print("\nPerformance Test Summary:")
    for key, value in summary.items():
        print(f"{key}: {value}")
