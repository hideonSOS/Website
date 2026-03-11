import pandas as pd


def motor_scrape(URL):
    df = pd.read_html(URL)
    df = df[1][['モーター  番号', '2連対率']]
    df.sort_values('モーター  番号', inplace=True)
    df.columns = ['number', 'ratio']
    return df
