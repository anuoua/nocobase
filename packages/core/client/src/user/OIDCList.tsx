import React, { useEffect, useState } from 'react';
import { Button, Space } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { useMemoizedFn } from 'ahooks';
import { css } from '@emotion/css';
import { useLocation } from 'react-router-dom';
import { useAPIClient } from '../api-client';
import { useRedirect } from './SigninPage';

export interface OIDCProvider {
  clientId: string;
  providerName: string;
  authorizeUrl: string;
}

export interface OIDCLocation {
  hash: string;
  pathname: string;
  query: {
    authenticator: string;
    clientId: string;
    code: string;
  };
  search: string;
  state: any;
}

export const OIDCList = () => {
  const [list, setList] = useState<OIDCProvider[]>([]);
  const { query } = useLocation() as OIDCLocation;
  const [windowHandler, setWindowHandler] = useState<Window | undefined>();
  const api = useAPIClient();
  const redirect = useRedirect();

  const getOidcList = async () => {
    const { data: pluginsRes } = await api.request({
      url: 'app:getPlugins',
    });
    if (!(pluginsRes.data as string[]).includes('oidc')) return;
    const { data: providersRes } = await api.request({
      url: 'oidcProviders:list',
      params: {
        filter: {
          'enable.$eq': true,
        },
      },
    });
    setList(providersRes.data);
  };

  /**
   * 打开登录弹出框
   */
  const handleOpen = useMemoizedFn(async (item: OIDCProvider) => {
    const response = await api.request({
      method: 'post',
      url: 'oidc:getAuthUrl',
      data: {
        clientId: item.clientId,
      },
    });

    const authUrl = response?.data?.data;
    const { width, height } = screen;

    const win = window.open(
      authUrl,
      '__blank',
      `width=800,height=600,left=${(width - 800) / 2},top=${
        (height - 600) / 2
      },toolbar=no,menubar=no,location=no,status=no`,
    );

    setWindowHandler(win);
  });

  /**
   * 从弹出窗口，发消息回来进行登录
   */
  const handleOIDCLogin = useMemoizedFn(async (event: MessageEvent) => {
    windowHandler.close();
    setWindowHandler(undefined);
    await api.auth.signIn(event.data, 'oidc');
    redirect();
  });

  /**
   * 监听弹出窗口的消息
   */
  useEffect(() => {
    if (!windowHandler) return;
    window.addEventListener('message', handleOIDCLogin);
    return () => {
      window.removeEventListener('message', handleOIDCLogin);
    };
  }, [windowHandler]);

  /**
   * 弹出窗口中重定向回来时触发
   * 回来的 url 会带上 authenticator、code、clientId
   */
  useEffect(() => {
    if (query.authenticator !== 'oidc') return;
    window.opener.postMessage(query, '*');
  }, [query.authenticator]);

  useEffect(() => {
    getOidcList();
  }, []);

  return (
    <Space
      direction="vertical"
      className={css`
        display: flex;
      `}
    >
      {list.map((item) => (
        <Button shape="round" block key={item.clientId} icon={<LoginOutlined />} onClick={() => handleOpen(item)}>
          OIDC {item.providerName}
        </Button>
      ))}
    </Space>
  );
};
