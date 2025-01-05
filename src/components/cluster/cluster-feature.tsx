/*
'use client'

import { useState } from 'react'
import { ClusterUiModal } from './cluster-ui'
import { ClusterUiTable } from './cluster-ui'

export default function ClusterFeature() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <ClusterUiModal show={showModal} hideModal={() => setShowModal(false)} />
      <button className="btn btn-xs lg:btn-md btn-primary" onClick={() => setShowModal(true)}>
        Add Cluster
      </button>
      <ClusterUiTable />
    </div>
  )
}
*/
