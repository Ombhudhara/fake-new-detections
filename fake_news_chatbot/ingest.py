"""
all-MiniLM-L6-v2 supports multilingual embeddings.
Users can query in any language and retrieve English docs correctly.
"""

import os
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

def ingest_site_content(urls: list[str]):
    """
    Scrapes website content, chunks it, and saves to local ChromaDB.
    """
    print(f"Ingesting content from {len(urls)} URLs...")
    
    # 1. Scraping
    loader = WebBaseLoader(urls)
    docs = loader.load()
    print(f"Loaded {len(docs)} documents.")

    # 2. Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
        add_start_index=True
    )
    all_splits = text_splitter.split_documents(docs)
    print(f"Split documents into {len(all_splits)} chunks.")

    # 3. Vectorization & Storing
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    persist_directory = "./chroma_db"
    
    # Create and persist the vectorstore
    vectorstore = Chroma.from_documents(
        documents=all_splits,
        embedding=embeddings,
        persist_directory=persist_directory
    )
    
    print(f"Vector Database successfully created and persisted at {persist_directory}")

if __name__ == "__main__":
    # Example Seed URLs for a fake news detector chatbot
    default_urls = [
        "https://en.wikipedia.org/wiki/Fake_news",
        "https://www.factcheck.org/about/",
        "https://www.poynter.org/fact-checking/",
        "https://guides.library.cornell.edu/evaluate_news"
    ]
    
    ingest_site_content(default_urls)
