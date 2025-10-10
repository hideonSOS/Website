
import pandas as pd

def scrape():
    path = 'https://www.boatrace-suminoe.jp/asp/htmlmade/suminoe/rank/rank.htm'
    df = pd.read_html(path)
    li = [str(i[1]) for i in df[0].columns]
    df[0].columns=li
    df = df[0]
    total_number = df .shape[0]
    df.iloc[0,:]
    df.fillna(0, inplace=True)
    
    return df

def motor_scrape(URL):
    
    df = pd.read_html(URL)
    df = df[1][[ 'モーター  番号', '2連対率']]
    df.sort_values('モーター  番号', inplace=True)
    df.columns=['number','ratio']
    return df


def scrape_point():
    import pandas as pd
    import numpy as np

    URL = 'https://www.boatrace-suminoe.jp/asp/htmlmade/suminoe/rank/rank.htm'

    df = pd.read_html(URL)[0]

    df.columns = [i for i in range(len(df.columns))]

    # 減点列の空白を０埋め、得点-減点で現時点の得点を算出して再代入
    df[6] = df[6].fillna(0).astype(int)
    df[5] = df[5] - df[6]

    # 着順の一覧表を取得して空白を０埋め
    dfs = df.iloc[:,8:]
    dfs = dfs.fillna('0')
    # dfs = dfs.apply(pd.to_numeric, errors='coerce').fillna(0).astype(int)
    values = dfs.values 
    arr = np.sort(values, axis=1)
    result = ['_'.join(map(str, row[row != '0'])) for row in arr]
    df['cyakujyun'] = result
    df = df[~df[4].isin(['帰郷','賞除'])]

    df = df.iloc[:,[1,2,5,7,-1]]

    df.columns=['number', 'name', 'point', 'count', 'cyakujyun']
    return df
    