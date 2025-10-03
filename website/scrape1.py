
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
    URL = 'https://www.boatrace-suminoe.jp/asp/htmlmade/suminoe/rank/rank.htm'
    df = pd.read_html(URL)[0]
    df = df.iloc[:,[1,2,5,7,6,4]]
    df.columns=['number','name','point','count','genten','percent']
    df['genten'].fillna(0, inplace=True)
    df = df[~df['percent'].isin(['帰郷'])]
    df['point'] = df['point']-df['genten']
    df = df[df.columns[[0,1,2,3]]]
    return df