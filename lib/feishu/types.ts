/**
 * 飞书多维表格（bitable）接入 —— 公共类型
 *
 * 仅描述飞书开放平台 bitable 的字段元数据、记录结构、API 响应与令牌响应。
 * 不依赖任何 env / key，纯结构定义，供 field-mapping / client / to-sheet-info 复用。
 *
 * 飞书 field_type 数字枚举（取自开放平台文档，列出常见项，未列出的默认映射 text）：
 *   1  多行文本   2  数字       3  单选        4  多选       5  日期
 *   7  复选框     8  货币       9  人员(人数)  10 进度       11 人员
 *   13 电话号码   14 邮箱       15 超链接      16 附件       17 单向关联
 *   18 双向关联   19 地理位置   21 公式        22 创建时间   23 最后更新时间
 *   24 自动编号   25 二维码     27 条码        30 评分       31 备注
 */

/** 飞书某字段的元数据（list_fields 接口返回） */
export interface FeishuFieldMeta {
  /** 字段 ID（稳定标识，与 record.fields 的键对应时优先用 field_name 兜底） */
  field_id: string;
  /** 字段显示名 */
  field_name: string;
  /** 字段类型（数字枚举，见文件头注释） */
  type: number;
  /** 是否为主键字段（部分接口会标 property） */
  is_primary?: boolean;
}

/** 飞书单条记录（list_records 接口返回，fields 为字段名→值的映射） */
export interface FeishuRecord {
  /** 记录 ID */
  record_id: string;
  /** 字段名 → 原始值（形态依赖字段类型） */
  fields: Record<string, unknown>;
}

/** list_fields 接口响应（节选） */
export interface FeishuListFieldsResponse {
  code: number;
  msg: string;
  data?: {
    items?: FeishuFieldMeta[];
    has_more?: boolean;
    page_token?: string;
  };
}

/** list_records 接口响应（节选） */
export interface FeishuListRecordsResponse {
  code: number;
  msg: string;
  data?: {
    items?: FeishuRecord[];
    has_more?: boolean;
    page_token?: string;
    total?: number;
  };
}

/** tenant_access_token / user_access_token 获取接口响应（节选） */
export interface FeishuTokenResponse {
  code: number;
  msg: string;
  /** 访问令牌（tenant 或 user） */
  access_token?: string;
  /** 刷新令牌（仅 user_access_token 流程有） */
  refresh_token?: string;
  /** 过期秒数 */
  expire?: number;
  /** 授权范围 */
  scope?: string;
}

/** 飞书 OAuth 授权码换 token 响应（节选） */
export interface FeishuOAuthTokenResponse {
  code: number;
  msg: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  /** 错误细分（如 invalid_grant） */
  error?: string;
  error_description?: string;
}

/** 飞书应用配置（从 env 读取，缺失时抛清晰错误） */
export interface FeishuAppConfig {
  appId: string;
  appSecret: string;
  /** 回调地址（与开放平台配置一致） */
  redirectUri: string;
}
