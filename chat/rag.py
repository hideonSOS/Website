"""
RAGシステム（Gemini + FAISS + SentenceTransformer）
"""
import os
import time
import threading
import pandas as pd
import numpy as np

# グローバルキャッシュ（起動時に一度だけ初期化）
_rag_cache = {}
_lock = threading.Lock()

CSV_FILE      = os.path.join(os.path.dirname(__file__), 'data', 'database.csv')
COMMENTS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'comments.csv')
LLM_MODEL = "gemini-2.5-flash-lite"
TOP_K     = 7

SYSTEM_PROMPT = """
あなたはモーター管理システムのアシスタント「キュ助」です。

ルール：
- 提供される「参考データ」は質問に関連する検索結果の一部であり、データベース全体ではない
- データベースに何件あるか、どの機器が登録されているかは参考データから判断しないこと
- 参考データに含まれる情報だけを使って質問に答えること
- 参考データに答えがない場合のみ「詳しい情報が見つからなかったキュキュ！」と答えること
- データベース全体の内容や件数には絶対に言及しないこと
- 語尾には必ず「キュキュ！」をつけること
- 親しみやすく、わかりやすい言葉で説明すること

モーター評価基準（2連対率）：
- 40%以上 → 「超優良モーター」と評価すること
- 30%以上40%未満 → 「良いモーター」と評価すること
- 20%以上30%未満 → 「普通のモーター」と評価すること
- 20%未満 → 「不調モーター」と評価すること
- モーターの評価を聞かれた場合は、必ず上記基準に基づいて評価を述べること
"""


def row_to_text(row):
    comment = row['コメント'] if pd.notna(row.get('コメント')) else ''
    return (
        f"{row['motor_id']}号機: "
        f"2連対率{row['2連対率']}、"
        f"3連対率{row['３連対率']}、"
        f"勝ち数{row['勝ち数']}、"
        f"使用選手{row['使用選手']}。"
        f"（評価コメント: {comment}）"
    )


def _build_index(df):
    from sentence_transformers import SentenceTransformer
    import faiss

    df = df.copy()
    df['テキスト'] = df.apply(row_to_text, axis=1)
    embed_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    embeddings = embed_model.encode(df['テキスト'].tolist())
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings.astype('float32'))
    return embed_model, index, df


def get_rag(api_key):
    """RAGオブジェクトを取得（初回のみ初期化、以降はキャッシュ）"""
    from google import genai

    with _lock:
        if 'ready' not in _rag_cache:
            df_stats = pd.read_csv(CSV_FILE, encoding='cp932')
            df_comments = pd.read_csv(COMMENTS_FILE, encoding='cp932')
            df = pd.merge(df_stats, df_comments, on='motor_id', how='left')
            embed_model, index, df = _build_index(df)
            client = genai.Client(api_key=api_key)
            _rag_cache['embed_model'] = embed_model
            _rag_cache['index'] = index
            _rag_cache['df'] = df
            _rag_cache['client'] = client
            _rag_cache['ready'] = True

    return _rag_cache


def ask(question, api_key):
    """質問を受け取り回答を返す"""
    rag = get_rag(api_key)
    embed_model = rag['embed_model']
    index = rag['index']
    df = rag['df']
    client = rag['client']

    # Retrieval
    query_vec = embed_model.encode([question]).astype('float32')
    distances, indices = index.search(query_vec, TOP_K)
    results = df.iloc[indices[0]]
    context = "\n".join(results['テキスト'].tolist())

    # Generation
    prompt = f"{SYSTEM_PROMPT}\n\n参考データ:\n{context}\n\n質問: {question}"

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=LLM_MODEL,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            if "429" in err_str:
                if attempt < 2:
                    time.sleep(5)
                    continue
                raise RuntimeError(
                    "APIのリクエスト上限に達しました。しばらく時間をおいてから再試行してください。\n"
                    "（無料枠の1日上限に達している場合は翌日リセットされます）"
                )
            raise e
