// Internal imports
import { IDataset } from '../interfaces/IDataset';
import { IModel } from '../interfaces/IModel';
import { IGenerationResponse } from '../interfaces/IGeneration';
import { ISafetyLog, GuardType, SafetyStatus, SafetyCheckType } from '../interfaces/ISafety';

/**
 * Generic interface for table column configuration
 */
interface TableColumn<T> {
  key: string;
  title: string;
  dataIndex: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, record: T) => React.ReactNode;
}

/**
 * Column definitions for dataset tables
 * Provides comprehensive dataset information and status tracking
 */
export const datasetColumns: TableColumn<IDataset>[] = [
  {
    key: 'id',
    title: 'ID',
    dataIndex: 'id',
    width: '80px',
    render: (id: string) => id.substring(0, 8)
  },
  {
    key: 'name',
    title: 'Name',
    dataIndex: 'name',
    sortable: true,
    width: '200px'
  },
  {
    key: 'videoCount',
    title: 'Videos',
    dataIndex: 'videoCount',
    sortable: true,
    width: '100px'
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    width: '120px',
    render: (status: string) => (
      <span className={`status-badge status-${status.toLowerCase()}`}>
        {status}
      </span>
    )
  },
  {
    key: 'createdAt',
    title: 'Created',
    dataIndex: 'createdAt',
    sortable: true,
    width: '150px',
    render: (date: Date) => new Date(date).toLocaleString()
  }
];

/**
 * Column definitions for model tables
 * Displays model information and operational status
 */
export const modelColumns: TableColumn<IModel>[] = [
  {
    key: 'id',
    title: 'ID',
    dataIndex: 'id',
    width: '80px',
    render: (id: string) => id.substring(0, 8)
  },
  {
    key: 'name',
    title: 'Name',
    dataIndex: 'name',
    sortable: true,
    width: '200px'
  },
  {
    key: 'type',
    title: 'Type',
    dataIndex: 'architecture.type',
    width: '150px',
    render: (type: string) => (
      <span className={`model-type-badge type-${type.toLowerCase()}`}>
        {type}
      </span>
    )
  },
  {
    key: 'parameters',
    title: 'Parameters',
    dataIndex: 'architecture.parameters',
    sortable: true,
    width: '120px',
    render: (params: number) => `${params}B`
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    width: '120px',
    render: (status: string) => (
      <span className={`status-badge status-${status.toLowerCase()}`}>
        {status}
      </span>
    )
  }
];

/**
 * Column definitions for generation tables
 * Includes comprehensive performance metrics and resource utilization
 */
export const generationColumns: TableColumn<IGenerationResponse>[] = [
  {
    key: 'id',
    title: 'ID',
    dataIndex: 'requestId',
    width: '80px',
    render: (id: string) => id.substring(0, 8)
  },
  {
    key: 'prompt',
    title: 'Prompt',
    dataIndex: 'prompt',
    width: '250px',
    render: (prompt: string) => (
      <div className="prompt-cell" title={prompt}>
        {prompt.length > 50 ? `${prompt.substring(0, 47)}...` : prompt}
      </div>
    )
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    width: '120px',
    render: (status: string) => (
      <span className={`status-badge status-${status.toLowerCase()}`}>
        {status}
      </span>
    )
  },
  {
    key: 'generationTime',
    title: 'Time (s)',
    dataIndex: 'generationTime',
    sortable: true,
    width: '100px',
    render: (time: number) => time.toFixed(1)
  },
  {
    key: 'gpuUtilization',
    title: 'GPU Usage',
    dataIndex: 'resourceUtilization.gpuUtilization',
    width: '120px',
    render: (usage: number) => (
      <div className="resource-usage-cell">
        <div className="usage-bar" style={{ width: `${usage}%` }} />
        <span>{`${usage.toFixed(1)}%`}</span>
      </div>
    )
  },
  {
    key: 'memoryUsage',
    title: 'Memory',
    dataIndex: 'resourceUtilization.memoryUsage',
    width: '100px',
    render: (memory: number) => `${memory.toFixed(1)} GB`
  }
];

/**
 * Column definitions for safety log tables
 * Provides comprehensive safety monitoring and audit trail
 */
export const safetyLogColumns: TableColumn<ISafetyLog>[] = [
  {
    key: 'id',
    title: 'ID',
    dataIndex: 'id',
    width: '80px',
    render: (id: string) => id.substring(0, 8)
  },
  {
    key: 'timestamp',
    title: 'Time',
    dataIndex: 'timestamp',
    sortable: true,
    width: '150px',
    render: (date: Date) => new Date(date).toLocaleString()
  },
  {
    key: 'guardType',
    title: 'Guard',
    dataIndex: 'guardType',
    width: '120px',
    render: (type: GuardType) => (
      <span className={`guard-type-badge guard-${type.toLowerCase()}`}>
        {type === GuardType.PRE_GUARD ? 'Pre-Guard' : 'Post-Guard'}
      </span>
    )
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    width: '100px',
    render: (status: SafetyStatus) => (
      <span className={`safety-status-badge status-${status.toLowerCase()}`}>
        {status}
      </span>
    )
  },
  {
    key: 'checkType',
    title: 'Check Type',
    dataIndex: 'checkType',
    width: '150px',
    render: (type: SafetyCheckType) => (
      <span className="check-type-cell">
        {type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
      </span>
    )
  },
  {
    key: 'details',
    title: 'Details',
    dataIndex: 'details',
    width: '200px',
    render: (details: Record<string, any>) => (
      <div className="details-cell" title={JSON.stringify(details, null, 2)}>
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="detail-item">
            {`${key}: ${value}`}
          </div>
        )).slice(0, 2)}
      </div>
    )
  }
];