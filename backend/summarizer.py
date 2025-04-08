from transformers import pipeline
import sys

# Load the pre-trained summarization model
summarizer = pipeline("summarization")

def summarize_text(text):
    try:
        # Summarize the given text
        summary = summarizer(text, max_length=150, min_length=50, do_sample=False)
        return summary[0]['summary_text']
    except Exception as e:
        print(f"Error summarizing text: {e}")
        return "Could not summarize the text."

if __name__ == "__main__":
    input_text = sys.stdin.read()  # Read input text from stdin
    summary = summarize_text(input_text)
    print(summary)  # Output the summarized text
