// frontend/api/mock/photos.ts
// POST /api/photos/explain (multipart/form-data)
// 响应字段严格匹配 docs/API接口文档.md §8.1

import type { ApiResponse } from '../types'

interface PhotoExplainData {
  photo_id: number
  image_path: string
  recognition_result: string
  explanation: string
  follow_up_questions: string[]
}

export const photoExplainMock: ApiResponse<PhotoExplainData> = {
  code: 0,
  message: 'success',
  data: {
    photo_id: 1,
    image_path: 'uploads/images/demo.jpg',
    recognition_result: '图片识别结果示例。',
    explanation: '景点讲解示例。',
    follow_up_questions: [],
  },
}
